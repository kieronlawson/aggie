import { Vertical, digestChannel, env } from "../config.js";
import { postMessage } from "../clients/slack.js";
import { embedTexts } from "../clients/voyage.js";
import { mapSeries, mapSeriesSettled } from "../lib/async.js";
import { daysAgoSeconds, nowSeconds } from "../lib/time.js";
import { itemsSince, rowToItem } from "../pipeline/items.js";
import type { StoredItem } from "../pipeline/types.js";
import { listSources } from "../registry/store.js";
import type { Source } from "../registry/types.js";
import { clusterItems } from "../report/cluster.js";
import { formatDigest } from "../report/format.js";
import { fetchPreviousReport, upsertReport } from "../report/reports.js";
import { summarizeCluster } from "../report/summarize.js";
import { synthesizeReport } from "../report/synthesize.js";
import { postFailures } from "./runlog.js";

const REPORT_WINDOW_DAYS = 7;
const EMPTY_WEEK_BODY = "No new items were captured for this vertical in the trailing 7 days.";

const requestedVerticals = (sources: readonly Source[]): Vertical[] => {
  const input = env("INPUT_VERTICAL", "");
  if (input !== "") {
    return [input as Vertical];
  }
  const active = sources.filter((source) => source.active).map((source) => source.vertical);
  return [...new Set(active)];
};

const quietSourceUrls = (sources: readonly Source[], items: readonly StoredItem[]): string[] => {
  const seenSourceIds = new Set(items.map((item) => item.source));
  return sources
    .filter((source) => source.active && !seenSourceIds.has(source.id))
    .map((source) => source.url);
};

const synthesizeBody = async (vertical: Vertical, items: readonly StoredItem[]): Promise<string> => {
  if (items.length === 0) {
    return EMPTY_WEEK_BODY;
  }
  const vectors = await embedTexts(items.map((item) => `${item.title}\n${item.summary}`));
  const vectorById = new Map(items.map((item, index) => [item.id, vectors[index] ?? []]));
  const clusters = clusterItems(items, (item) => vectorById.get(item.id) ?? []);
  const summaries = await mapSeries(clusters, summarizeCluster);
  const previous = await fetchPreviousReport(vertical);
  return synthesizeReport(vertical, summaries, previous?.body ?? "");
};

const runVertical = async (vertical: Vertical, sources: readonly Source[]): Promise<string> => {
  const verticalSources = sources.filter((source) => source.vertical === vertical);
  const rows = await itemsSince(vertical, daysAgoSeconds(REPORT_WINDOW_DAYS));
  const items = rows.map(rowToItem);
  const reportDate = nowSeconds();
  const body = await synthesizeBody(vertical, items);
  const digest = formatDigest({
    vertical,
    reportDate,
    body,
    quietSources: quietSourceUrls(verticalSources, items),
    failedSources: []
  });
  await postMessage(digestChannel(), digest);
  await upsertReport(vertical, reportDate, digest);
  return `${vertical}: ${items.length} items`;
};

const main = async (): Promise<void> => {
  const sources = await listSources();
  const verticals = requestedVerticals(sources);
  const results = await mapSeriesSettled(verticals, (vertical) => runVertical(vertical, sources));
  const failures = results
    .filter((result) => !result.ok)
    .map((result) => ({ label: String(result.input), error: result.ok ? "" : result.error }));
  console.log(results.map((result) => (result.ok ? result.value : `${result.input} FAILED`)).join("\n"));
  await postFailures("w3-report", failures);
  if (failures.length > 0) {
    throw new Error(`Report failed for: ${failures.map((failure) => failure.label).join(", ")}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
