import { parseArgs } from "node:util";

import * as R from "ramda";

import { fetchFeedEntries, mapEntryToRawItem } from "#src/clients/feeds.ts";
import { remainingCredits, scrapeMarkdown } from "#src/clients/firecrawl.ts";
import { postMessage, SlackChannel } from "#src/clients/slack.ts";
import { patchRows, queryRows, type TpufResultRow, upsertRows } from "#src/clients/turbopuffer.ts";
import { embed } from "#src/clients/voyage.ts";
import { pacedSequentially, sequentially } from "#src/lib/async.ts";
import { classifyItem } from "#src/pipeline/classify.ts";
import { NEW_PAGE_CHARS } from "#src/pipeline/crawl.ts";
import { creditsCover, retrieveArticles, SCRAPE_PACE_MS } from "#src/pipeline/enrich.ts";
import { contentHash, normalizeContent } from "#src/pipeline/normalize.ts";
import { DIFF_TEXT_SCHEMA, itemsNamespaceFor, ProcessOutcome, processRawItem, seenItemUrls } from "#src/pipeline/process.ts";
import { type RawItem } from "#src/pipeline/types.ts";
import { loadActiveSources, loadCompetitors } from "#src/registry/read.ts";
import { Relationship, SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";

/** Items older than this are ignored; the first run doubles as the backfill. */
const INGEST_MAX_AGE_DAYS = 14;
const DAY_MS = 86_400_000;

type CollectedSource = {
  source: SourceRecord;
  fetched: number;
  fresh: number;
  unseen: RawItem[];
  error: string;
};

type SourceResult = {
  source: string;
  fetched: number;
  fresh: number;
  stored: number;
  merged: number;
  thin: number;
  thinDetail: string;
  error: string;
};

const freshItems = (items: RawItem[], nowMs: number): RawItem[] => {
  const cutoff = nowMs - INGEST_MAX_AGE_DAYS * DAY_MS;
  return R.uniqBy(
    (item: RawItem) => item.url,
    R.filter((item: RawItem) => item.url.startsWith("http") && Date.parse(item.published_at) >= cutoff, items)
  );
};

/** Fetch + filter only — retrieval and processing wait for the run-wide credits check. */
const collectSource = async (
  source: SourceRecord,
  relationshipByName: Record<string, Relationship>
): Promise<CollectedSource> => {
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
    return { source, fetched: entries.length, fresh: fresh.length, unseen, error: "" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { source, fetched: 0, fresh: 0, unseen: [], error: detail };
  }
};

/** Retrieves each unseen item's article (unless credits ruled it out), then processes. */
const processCollected = async (collected: CollectedSource, retrieve: boolean): Promise<SourceResult> => {
  const base = {
    source: collected.source.name,
    fetched: collected.fetched,
    fresh: collected.fresh,
    stored: 0,
    merged: 0,
    thin: 0,
    thinDetail: "",
    error: collected.error
  };
  if (collected.error.length > 0) {
    return base;
  }
  const { items, failures } = retrieve
    ? await retrieveArticles(collected.unseen)
    : { items: collected.unseen, failures: [] };
  const outcomes = await sequentially(items, processRawItem);
  return {
    ...base,
    stored: R.count((outcome) => outcome === ProcessOutcome.Stored, outcomes),
    merged: R.count((outcome) => outcome === ProcessOutcome.Merged, outcomes),
    thin: failures.length,
    thinDetail: failures[0] ?? ""
  };
};

const summarize = (results: SourceResult[], retrieve: boolean): string => {
  const stored = R.sum(R.map((result: SourceResult) => result.stored, results));
  const merged = R.sum(R.map((result: SourceResult) => result.merged, results));
  const failures = R.filter((result: SourceResult) => result.error.length > 0, results);
  const failureLines = R.map(
    (failure: SourceResult) => `⚠️ ${failure.source}: ${failure.error}`,
    failures
  );
  const creditsLine = retrieve
    ? []
    : ["⚠️ Firecrawl credits below the fresh-item count — article retrieval skipped, items stored thin."];
  const thinLines = R.map(
    (result: SourceResult) =>
      `⚠️ ${result.source}: ${String(result.thin)} article retrievals failed, kept thin (${result.thinDetail})`,
    R.filter((result: SourceResult) => result.thin > 0, results)
  );
  return [
    `📥 Aggie ingest: ${String(results.length)} feed sources, ${String(stored)} new items stored, ` +
      `${String(merged)} merged as duplicates, ${String(failures.length)} source failures.`,
    ...creditsLine,
    ...thinLines,
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
  const collected = await sequentially(sources, (source) => collectSource(source, relationshipByName));
  const totalUnseen = R.sum(R.map((entry: CollectedSource) => entry.unseen.length, collected));
  const retrieve = await creditsCover(totalUnseen);
  const results = await sequentially(collected, (entry) => processCollected(entry, retrieve));
  const summary = summarize(results, retrieve);
  console.log(summary);
  await postMessage(SlackChannel.IntelStaging, summary);
};

const ARTICLE_BACKFILL_MODE = "article-backfill";

/** Rebuilds a stored feed item from its freshly scraped article: classify, hash, embed, upsert. */
const enrichStoredRow = async (vertical: Vertical, row: TpufResultRow): Promise<string> => {
  try {
    const url = str(row, "url");
    const scrape = await scrapeMarkdown(url);
    const storedRelationship = str(row, "relationship");
    const pseudoItem: RawItem = {
      url,
      title: str(row, "title"),
      content: scrape.markdown.slice(0, NEW_PAGE_CHARS),
      published_at: str(row, "published_at"),
      source: str(row, "source"),
      vertical,
      competitor: str(row, "competitor"),
      relationship: storedRelationship.length > 0 ? (storedRelationship as Relationship) : Relationship.Regulatory
    };
    const classified = await classifyItem(pseudoItem);
    const vectors = await embed([`${classified.title}\n${classified.summary}`], "document");
    const vector = vectors[0];
    if (vector === undefined) {
      throw new Error(`Voyage returned no embedding for ${url}`);
    }
    const publishedAtMs = row["published_at_ms"];
    await upsertRows(itemsNamespaceFor(vertical), [
      {
        id: row.id,
        vector,
        url,
        source: pseudoItem.source,
        vertical,
        competitor: pseudoItem.competitor,
        relationship: pseudoItem.relationship,
        classification: classified.classification,
        sentiment: classified.sentiment,
        published_at: pseudoItem.published_at,
        published_at_ms: typeof publishedAtMs === "number" ? publishedAtMs : Date.parse(pseudoItem.published_at),
        title: classified.title.length > 0 ? classified.title : pseudoItem.title,
        summary: classified.summary,
        entities: classified.entities,
        relevant: classified.relevant,
        content_kind: classified.content_kind,
        merged_urls: Array.isArray(row["merged_urls"]) ? (row["merged_urls"] as string[]) : [],
        content_hash: contentHash(normalizeContent(`${pseudoItem.title}\n${pseudoItem.content}`)),
        story_id: str(row, "story_id"),
        diff_text: str(row, "diff_text")
      }
    ], DIFF_TEXT_SCHEMA);
    return "";
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return `${str(row, "url")}: ${detail}`;
  }
};

/** Digest-facing window: items older than the coming weekly digest never resurface. */
const BACKFILL_WINDOW_DAYS = 7;

/** Credits left untouched so the scheduled ingest and weekly crawl are never starved. */
const BACKFILL_CREDIT_RESERVE = 500;

type BackfillTarget = { vertical: Vertical; row: TpufResultRow };

const publishedMs = (row: TpufResultRow): number =>
  typeof row["published_at_ms"] === "number" ? row["published_at_ms"] : 0;

const backfillTargets = async (feedNames: string[], cutoffMs: number): Promise<BackfillTarget[]> => {
  const byVertical = await sequentially(Object.values(Vertical), async (vertical) => {
    const rows = await queryRows({
      namespace: itemsNamespaceFor(vertical),
      filters: ["And", [["source", "In", feedNames], ["published_at_ms", "Gte", cutoffMs]]],
      topK: BACKFILL_QUERY_LIMIT,
      includeAttributes: true
    });
    return R.map((row: TpufResultRow): BackfillTarget => ({ vertical, row }), rows);
  });
  return R.sortBy((target: BackfillTarget) => -publishedMs(target.row), R.flatten(byVertical));
};

/**
 * One-off: re-enriches stored feed items from the digest window whose
 * classification ran on thin feed bodies (pre-retrieval, or 429 fallbacks
 * from the 2026-08-05 run). Feed sources only — crawl diff items must keep
 * their diff content — and story_id/merged_urls are preserved so clustering
 * and dedupe history stay intact. Never alerts. Spends at most the credits
 * above the reserve, newest items first; the shortfall is reported.
 */
const articleBackfill = async (): Promise<void> => {
  const feedSources = await loadActiveSources(SourceKind.Feed);
  const feedNames = R.map((source: SourceRecord) => source.name, feedSources);
  const cutoffMs = Date.now() - BACKFILL_WINDOW_DAYS * DAY_MS;
  const targets = await backfillTargets(feedNames, cutoffMs);
  const budget = Math.max(0, (await remainingCredits()) - BACKFILL_CREDIT_RESERVE);
  const withinBudget = R.take(budget, targets);
  const skipped = targets.length - withinBudget.length;
  const outcomes = await pacedSequentially(
    withinBudget,
    (target: BackfillTarget) => enrichStoredRow(target.vertical, target.row),
    SCRAPE_PACE_MS
  );
  const failures = R.reject(R.isEmpty, outcomes);
  const reserveNote = `preserve the ${String(BACKFILL_CREDIT_RESERVE)}-credit reserve`;
  const skippedLine = skipped > 0 ? [`⚠️ ${String(skipped)} oldest targets skipped to ${reserveNote}.`] : [];
  const failureLines = R.map((failure: string) => `⚠️ ${failure}`, R.take(1, failures));
  const summary = [
    `🧹 Aggie article backfill complete — enriched ${String(withinBudget.length - failures.length)} of ` +
      `${String(targets.length)} targeted items; ${String(failures.length)} scrape failures kept thin.`,
    ...skippedLine,
    ...failureLines
  ].join("\n");
  console.log(summary);
  await postMessage(SlackChannel.IntelStaging, summary);
};

const MODE_HANDLERS: Record<string, () => Promise<void>> = {
  [RELEVANCE_BACKFILL_MODE]: relevanceBackfill,
  [SOURCE_NAME_BACKFILL_MODE]: sourceNameBackfill,
  [ARTICLE_BACKFILL_MODE]: articleBackfill
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
