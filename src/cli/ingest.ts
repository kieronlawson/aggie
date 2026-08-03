import { parseArgs } from "node:util";

import * as R from "ramda";

import { fetchFeedEntries, mapEntryToRawItem } from "#src/clients/feeds.ts";
import { postMessage, SlackChannel } from "#src/clients/slack.ts";
import { patchRows, queryRows, type TpufResultRow } from "#src/clients/turbopuffer.ts";
import { sequentially } from "#src/lib/async.ts";
import { classifyItem } from "#src/pipeline/classify.ts";
import { itemsNamespaceFor, ProcessOutcome, processRawItem, seenItemUrls } from "#src/pipeline/process.ts";
import { type RawItem } from "#src/pipeline/types.ts";
import { loadActiveSources, loadCompetitors } from "#src/registry/read.ts";
import { Relationship, SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";

/** Items older than this are ignored; the first run doubles as the backfill. */
const INGEST_MAX_AGE_DAYS = 14;
const DAY_MS = 86_400_000;

type SourceResult = {
  source: string;
  fetched: number;
  fresh: number;
  stored: number;
  merged: number;
  error: string;
};

const freshItems = (items: RawItem[], nowMs: number): RawItem[] => {
  const cutoff = nowMs - INGEST_MAX_AGE_DAYS * DAY_MS;
  return R.uniqBy(
    (item: RawItem) => item.url,
    R.filter((item: RawItem) => item.url.startsWith("http") && Date.parse(item.published_at) >= cutoff, items)
  );
};

const ingestSource = async (
  source: SourceRecord,
  relationshipByName: Record<string, Relationship>
): Promise<SourceResult> => {
  try {
    const entries = await fetchFeedEntries(source.url);
    const relationship =
      source.competitor.length === 0
        ? Relationship.Regulatory
        : relationshipByName[source.competitor] ?? Relationship.Displace;
    const nowIso = new Date().toISOString();
    const mapped = R.map((entry) => mapEntryToRawItem(entry, source, relationship, nowIso), entries);
    const fresh = freshItems(mapped, Date.now());
    const seen = await seenItemUrls(R.map((item: RawItem) => item.url, fresh));
    const unseen = R.reject((item: RawItem) => seen.has(item.url), fresh);
    const outcomes = await sequentially(unseen, processRawItem);
    return {
      source: source.name,
      fetched: entries.length,
      fresh: fresh.length,
      stored: R.count((outcome) => outcome === ProcessOutcome.Stored, outcomes),
      merged: R.count((outcome) => outcome === ProcessOutcome.Merged, outcomes),
      error: ""
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { source: source.name, fetched: 0, fresh: 0, stored: 0, merged: 0, error: detail };
  }
};

const summarize = (results: SourceResult[]): string => {
  const stored = R.sum(R.map((result: SourceResult) => result.stored, results));
  const merged = R.sum(R.map((result: SourceResult) => result.merged, results));
  const failures = R.filter((result: SourceResult) => result.error.length > 0, results);
  const failureLines = R.map(
    (failure: SourceResult) => `⚠️ ${failure.source}: ${failure.error}`,
    failures
  );
  return [
    `📥 Aggie ingest: ${String(results.length)} feed sources, ${String(stored)} new items stored, ` +
      `${String(merged)} merged as duplicates, ${String(failures.length)} source failures.`,
    ...failureLines
  ].join("\n");
};

const BACKFILL_QUERY_LIMIT = 1200;
const RELEVANCE_BACKFILL_MODE = "relevance-backfill";
const SOURCE_NAME_BACKFILL_MODE = "source-name-backfill";

const str = (row: TpufResultRow, key: string): string => {
  const value = row[key];
  return typeof value === "string" ? value : "";
};

const reclassifyRow = async (vertical: Vertical, row: TpufResultRow): Promise<boolean> => {
  const storedRelationship = str(row, "relationship");
  const pseudoItem: RawItem = {
    url: str(row, "url"),
    title: str(row, "title"),
    content: str(row, "summary").length > 0 ? str(row, "summary") : str(row, "title"),
    published_at: str(row, "published_at"),
    source: str(row, "source"),
    vertical,
    competitor: str(row, "competitor"),
    relationship: storedRelationship.length > 0 ? (storedRelationship as Relationship) : Relationship.Regulatory
  };
  const classified = await classifyItem(pseudoItem);
  await patchRows(itemsNamespaceFor(vertical), [{ id: row.id, relevant: classified.relevant }]);
  return classified.relevant;
};

/** One-off: re-judges relevance for already-stored items that predate the filter. */
const relevanceBackfill = async (): Promise<void> => {
  const results = await sequentially(Object.values(Vertical), async (vertical) => {
    const rows = await queryRows({
      namespace: itemsNamespaceFor(vertical),
      filters: ["url", "Glob", "http*"],
      topK: BACKFILL_QUERY_LIMIT,
      includeAttributes: ["url", "title", "summary", "competitor", "relationship", "published_at", "source"]
    });
    const verdicts = await sequentially(rows, (row) => reclassifyRow(vertical, row));
    return { vertical, total: rows.length, relevant: R.count(Boolean, verdicts) };
  });
  const lines = R.map(
    (result) => `${result.vertical}: ${String(result.relevant)}/${String(result.total)} relevant`,
    results
  );
  const summary = `🧹 Aggie relevance backfill complete — ${lines.join(", ")}.`;
  console.log(summary);
  await postMessage(SlackChannel.IntelStaging, summary);
};

const renameSourceRows = async (source: SourceRecord): Promise<number> => {
  const rows = await queryRows({
    namespace: itemsNamespaceFor(source.vertical),
    filters: ["source", "Eq", source.url],
    topK: BACKFILL_QUERY_LIMIT,
    includeAttributes: ["url"]
  });
  if (rows.length === 0) {
    return 0;
  }
  await patchRows(
    itemsNamespaceFor(source.vertical),
    R.map((row) => ({ id: row.id, source: source.name }), rows)
  );
  return rows.length;
};

/** One-off: feed items stored before 2026-07-29 carry the feed URL in `source`; rename to the registry name. */
const sourceNameBackfill = async (): Promise<void> => {
  const sources = await loadActiveSources(SourceKind.Feed);
  const counts = await sequentially(sources, renameSourceRows);
  const patched = R.sum(counts);
  const summary = `🧹 Aggie source-name backfill complete — ${String(patched)} item rows renamed across ${String(
    R.count((count: number) => count > 0, counts)
  )} sources.`;
  console.log(summary);
  await postMessage(SlackChannel.IntelStaging, summary);
};

const runIngest = async (): Promise<void> => {
  const sources = await loadActiveSources(SourceKind.Feed);
  const competitors = await loadCompetitors();
  const relationshipByName = R.fromPairs(
    R.map((competitor) => [competitor.name, competitor.relationship] as [string, Relationship], competitors)
  );
  const results = await sequentially(sources, (source) => ingestSource(source, relationshipByName));
  const summary = summarize(results);
  console.log(summary);
  await postMessage(SlackChannel.IntelStaging, summary);
};

const MODE_HANDLERS: Record<string, () => Promise<void>> = {
  [RELEVANCE_BACKFILL_MODE]: relevanceBackfill,
  [SOURCE_NAME_BACKFILL_MODE]: sourceNameBackfill
};

const main = async (): Promise<void> => {
  const { values } = parseArgs({ options: { mode: { type: "string" } } });
  const mode = values.mode ?? "";
  await (MODE_HANDLERS[mode] ?? runIngest)();
};

await main().catch(async (error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`aggie ingest failed: ${detail}`);
  process.exitCode = 1;
  await postMessage(SlackChannel.IntelStaging, `❌ aggie ingest failed: ${detail}`).catch(() => undefined);
});
