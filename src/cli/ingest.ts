import { Relationship, SourceKind, env } from "../config.js";
import { mapSeries, mapSeriesSettled } from "../lib/async.js";
import { daysAgoSeconds } from "../lib/time.js";
import { activeSourcesByKind, listCompetitors } from "../registry/store.js";
import type { Competitor, Source } from "../registry/types.js";
import type { FeedEntry } from "../pipeline/feeds.js";
import { fetchFeed } from "../pipeline/feeds.js";
import { fetchJobBoard } from "../pipeline/jobboards.js";
import { seenUrls } from "../pipeline/items.js";
import { ProcessOutcome, processRawItem } from "../pipeline/process.js";
import type { RawItem } from "../pipeline/types.js";
import { postFailures, postRunSummary } from "./runlog.js";

const DEFAULT_BACKFILL_DAYS = 3;
const JOB_BOARD_DAY_UTC = 5;
const MAX_ITEMS_PER_SOURCE = 200;
const TRUE_STRING = "true";

type SourceStats = { source: Source; fetched: number; fresh: number; stored: number; merged: number };

const backfillDays = (): number => {
  const parsed = Number(env("INPUT_BACKFILL_DAYS", String(DEFAULT_BACKFILL_DAYS)));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BACKFILL_DAYS;
};

const jobBoardsDue = (): boolean =>
  env("INPUT_FORCE_JOB_BOARDS", "") === TRUE_STRING || new Date().getUTCDay() === JOB_BOARD_DAY_UTC;

const dueToday = (source: Source): boolean =>
  source.kind !== SourceKind.JobBoard || jobBoardsDue();

const relationshipFor = (source: Source, competitors: readonly Competitor[]): Relationship => {
  if (source.competitor === "") {
    return Relationship.Regulatory;
  }
  const match = competitors.find(
    (competitor) => competitor.name.toLowerCase() === source.competitor.toLowerCase()
  );
  return match?.relationship ?? Relationship.Displace;
};

const fetchEntries = (source: Source): Promise<FeedEntry[]> =>
  source.kind === SourceKind.JobBoard ? fetchJobBoard(source.url) : fetchFeed(source.url);

const toRawItem = (source: Source, relationship: Relationship, entry: FeedEntry): RawItem => ({
  url: entry.url,
  sourceId: source.id,
  sourceKind: source.kind,
  vertical: source.vertical,
  competitor: source.competitor,
  relationship,
  title: entry.title,
  content: entry.content,
  publishedAt: entry.publishedAt,
  diff: ""
});

const isStoredOutcome = (outcome: ProcessOutcome): boolean =>
  outcome === ProcessOutcome.Stored || outcome === ProcessOutcome.StoredSameStory;

const ingestSource = async (
  source: Source,
  competitors: readonly Competitor[],
  cutoff: number
): Promise<SourceStats> => {
  const relationship = relationshipFor(source, competitors);
  const entries = await fetchEntries(source);
  const recent = entries
    .filter((entry) => entry.publishedAt >= cutoff)
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, MAX_ITEMS_PER_SOURCE);
  const seen = await seenUrls(source.vertical, recent.map((entry) => entry.url));
  const fresh = recent.filter((entry) => !seen.has(entry.url));
  const outcomes = await mapSeries(fresh, (entry) =>
    processRawItem(toRawItem(source, relationship, entry))
  );
  return {
    source,
    fetched: entries.length,
    fresh: fresh.length,
    stored: outcomes.filter(isStoredOutcome).length,
    merged: outcomes.filter((outcome) => !isStoredOutcome(outcome)).length
  };
};

const statsLine = (stats: SourceStats): string =>
  `• ${stats.source.url} — fetched ${stats.fetched}, new ${stats.fresh}, stored ${stats.stored}, merged ${stats.merged}`;

const main = async (): Promise<void> => {
  const days = backfillDays();
  const cutoff = daysAgoSeconds(days);
  const allSources = await activeSourcesByKind([SourceKind.Feed, SourceKind.JobBoard]);
  const sources = allSources.filter(dueToday);
  const competitors = await listCompetitors();
  const results = await mapSeriesSettled(sources, (source) => ingestSource(source, competitors, cutoff));

  const succeeded = results.filter((result) => result.ok);
  const failures = results
    .filter((result) => !result.ok)
    .map((result) => ({
      label: result.input.url,
      error: result.ok ? "" : result.error
    }));

  const stored = succeeded.reduce((sum, result) => (result.ok ? sum + result.value.stored : sum), 0);
  const summary = [
    `ingest window ${days}d — ${sources.length} sources, ${stored} items stored, ${failures.length} failed`,
    ...succeeded.map((result) => (result.ok ? statsLine(result.value) : ""))
  ].filter((line) => line !== "");

  console.log(summary.join("\n"));
  await postRunSummary("w1-ingest", summary);
  await postFailures("w1-ingest", failures);
  if (sources.length > 0 && succeeded.length === 0) {
    throw new Error("Every source failed during ingest");
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
