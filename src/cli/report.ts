import { parseArgs } from "node:util";

import * as R from "ramda";

import { postMessage, postThreadReply, SlackChannel } from "#src/clients/slack.ts";
import { queryRows, TpufNamespace } from "#src/clients/turbopuffer.ts";
import { sequentially } from "#src/lib/async.ts";
import { loadActiveSources } from "#src/registry/read.ts";
import { sourcedVerticals } from "#src/registry/records.ts";
import { SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";
import { appendStaticSections, quietSources, splitDigest } from "#src/report/format.ts";
import { generateDigestBody, upsertReport } from "#src/report/generate.ts";
import { chunkForSlack, toMrkdwn } from "#src/report/mrkdwn.ts";

const VERTICALS: string[] = Object.values(Vertical);
const DATE_LENGTH = 10;

const parseVertical = (value: string): Vertical => {
  if (!VERTICALS.includes(value)) {
    throw new Error(`Unknown vertical "${value}" — expected one of: ${VERTICALS.join(", ")}`);
  }
  return value as Vertical;
};

const alreadyDelivered = async (vertical: Vertical, reportDate: string): Promise<boolean> => {
  const rows = await queryRows({
    namespace: TpufNamespace.Reports,
    filters: ["id", "Eq", `report:${vertical}:${reportDate}`],
    topK: 1,
    includeAttributes: ["report_date"]
  });
  return rows.length > 0;
};

const CARD_POINTER = "🧵 _Full digest in thread →_";

/**
 * Promotion map: a vertical's digest moves out of staging when its gate passes.
 * Competitor promoted 2026-07-24 (Kieron); ops posts (📭/❌) always stay in staging.
 */
const channelFor = (vertical: Vertical): SlackChannel =>
  vertical === Vertical.Competitor ? SlackChannel.IntelCompetitive : SlackChannel.IntelStaging;

const deliverToSlack = async (channel: SlackChannel, card: string, thread: string): Promise<void> => {
  const cardChunks = chunkForSlack(toMrkdwn(card));
  const threadChunks = chunkForSlack(toMrkdwn(thread));
  const [first, ...cardOverflow] = cardChunks;
  const threadTs = await postMessage(channel, first ?? "");
  await sequentially([...cardOverflow, ...threadChunks], async (chunk) => {
    await postThreadReply(channel, threadTs, chunk);
  });
};

const TRUE_FLAG = "true";

type ReportVerticalOpts = {
  vertical: Vertical;
  force: boolean;
  reportDate: string;
  sources: SourceRecord[];
};

const reportVertical = async ({ vertical, force, reportDate, sources }: ReportVerticalOpts): Promise<void> => {
  if (!force && (await alreadyDelivered(vertical, reportDate))) {
    console.log(`Digest for ${vertical} on ${reportDate} already delivered — skipping (idempotent re-run).`);
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
  const { card, thread } = splitDigest(digest);
  const header =
    `📡 *Aggie · ${vertical} · week of ${reportDate}* — ` +
    `${String(generated.items)} items · ${String(generated.clusters)} stories`;
  const cardText = [header, card, CARD_POINTER].filter((part) => part.length > 0).join("\n\n");
  const channel = channelFor(vertical);
  await deliverToSlack(channel, cardText, thread);
  await upsertReport(vertical, reportDate, digest);
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
