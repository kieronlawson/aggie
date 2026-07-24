import { parseArgs } from "node:util";

import * as R from "ramda";

import { postMessage, postThreadReply, SlackChannel } from "#src/clients/slack.ts";
import { queryRows, TpufNamespace, type TpufResultRow } from "#src/clients/turbopuffer.ts";
import { sequentially } from "#src/lib/async.ts";
import { loadActiveSources } from "#src/registry/read.ts";
import { sourcedVerticals } from "#src/registry/records.ts";
import { SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";
import { type DigestCounts, type DigestMessages, digestMessages } from "#src/report/blocks.ts";
import { appendStaticSections, quietSources } from "#src/report/format.ts";
import { generateDigestBody, upsertReport } from "#src/report/generate.ts";

const VERTICALS: string[] = Object.values(Vertical);
const DATE_LENGTH = 10;

const parseVertical = (value: string): Vertical => {
  if (!VERTICALS.includes(value)) {
    throw new Error(`Unknown vertical "${value}" — expected one of: ${VERTICALS.join(", ")}`);
  }
  return value as Vertical;
};

type StoredReport = {
  body: string;
  counts: DigestCounts | undefined;
};

const countOf = (row: TpufResultRow, key: string): number | undefined => {
  const value = row[key];
  return typeof value === "number" ? value : undefined;
};

const storedReport = async (vertical: Vertical, reportDate: string): Promise<StoredReport | undefined> => {
  const rows = await queryRows({
    namespace: TpufNamespace.Reports,
    filters: ["id", "Eq", `report:${vertical}:${reportDate}`],
    topK: 1
  });
  const row = rows[0];
  if (row === undefined) {
    return undefined;
  }
  const items = countOf(row, "items");
  const clusters = countOf(row, "clusters");
  return {
    body: typeof row["body"] === "string" ? row["body"] : "",
    counts: items === undefined || clusters === undefined ? undefined : { items, clusters }
  };
};

/**
 * Promotion map: a vertical's digest moves out of staging when its gate passes.
 * Competitor promoted 2026-07-24 (Kieron); ops posts (📭/❌) always stay in staging.
 */
const channelFor = (vertical: Vertical): SlackChannel =>
  vertical === Vertical.Competitor ? SlackChannel.IntelCompetitive : SlackChannel.IntelStaging;

const deliverToSlack = async (channel: SlackChannel, { card, replies }: DigestMessages): Promise<void> => {
  const threadTs = await postMessage(channel, card.text, card.blocks);
  await sequentially(replies, async (reply) => {
    await postThreadReply({ channel, threadTs, text: reply.text, blocks: reply.blocks });
  });
};

const TRUE_FLAG = "true";

type ReportVerticalOpts = {
  vertical: Vertical;
  force: boolean;
  reportDate: string;
  sources: SourceRecord[];
};

/** Re-delivers the digest exactly as first generated — a force re-run never rewrites content. */
const repostStored = async (vertical: Vertical, reportDate: string, stored: StoredReport): Promise<void> => {
  const messages = digestMessages({ vertical, reportDate, counts: stored.counts }, stored.body);
  const channel = channelFor(vertical);
  await deliverToSlack(channel, messages);
  console.log(`Stored digest for ${vertical} (${reportDate}) reposted to ${channel} — not regenerated.`);
};

const reportVertical = async ({ vertical, force, reportDate, sources }: ReportVerticalOpts): Promise<void> => {
  const stored = await storedReport(vertical, reportDate);
  if (stored !== undefined && !force) {
    console.log(`Digest for ${vertical} on ${reportDate} already delivered — skipping (idempotent re-run).`);
    return;
  }
  if (stored !== undefined) {
    await repostStored(vertical, reportDate, stored);
    return;
  }
  const generated = await generateDigestBody(vertical);
  if (generated.items === 0) {
    const note = `📭 Aggie ${vertical} digest: no items in the trailing 7 days — nothing to report.`;
    console.log(note);
    await postMessage(SlackChannel.IntelStaging, note);
    return;
  }
  const registered = R.filter((source: SourceRecord) => source.vertical === vertical, sources);
  const quiet = quietSources(registered, generated.itemSources);
  const footerNotes =
    quiet.length > 0 ? [`Quiet sources this week (no relevant items — may be fine): ${quiet.join(" · ")}`] : [];
  const digest = appendStaticSections(generated.body, footerNotes);
  const counts = { items: generated.items, clusters: generated.clusters };
  const messages = digestMessages({ vertical, reportDate, counts }, digest);
  const channel = channelFor(vertical);
  await deliverToSlack(channel, messages);
  await upsertReport({ vertical, reportDate, body: digest, items: generated.items, clusters: generated.clusters });
  console.log(`Digest for ${vertical} posted to ${channel} (threaded) and upserted (${reportDate}).`);
};

/** One vertical's failure must not block the rest — collect it for the single ❌ post. */
const reportVerticalSafely = async (opts: ReportVerticalOpts): Promise<string> => {
  try {
    await reportVertical(opts);
    return "";
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return `${opts.vertical}: ${detail}`;
  }
};

const main = async (): Promise<void> => {
  const { values } = parseArgs({ options: { vertical: { type: "string" }, force: { type: "string" } } });
  const requested = values.vertical ?? "";
  const force = values.force === TRUE_FLAG;
  const reportDate = new Date().toISOString().slice(0, DATE_LENGTH);
  const feedSources = await loadActiveSources(SourceKind.Feed);
  const crawlSources = await loadActiveSources(SourceKind.Crawl);
  const sources = [...feedSources, ...crawlSources];
  const verticals = requested.length === 0 ? sourcedVerticals(sources) : [parseVertical(requested)];
  const outcomes = await sequentially(verticals, (vertical) =>
    reportVerticalSafely({ vertical, force, reportDate, sources })
  );
  const failures = R.reject(R.isEmpty, outcomes);
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
};

await main().catch(async (error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`aggie report failed: ${detail}`);
  process.exitCode = 1;
  await postMessage(SlackChannel.IntelStaging, `❌ aggie report failed: ${detail}`).catch(() => undefined);
});
