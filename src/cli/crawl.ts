import * as R from "ramda";

import {
  BATCH_STATUS_COMPLETED,
  BATCH_STATUS_FAILED,
  type BatchResults,
  ChangeStatus,
  type CrawlPageResult,
  getBatchResults,
  remainingCredits,
  startChangeTrackingBatch
} from "#src/clients/firecrawl.ts";
import { postMessage, SlackChannel } from "#src/clients/slack.ts";
import { queryRows } from "#src/clients/turbopuffer.ts";
import { sequentially } from "#src/lib/async.ts";
import { crawlRawItem } from "#src/pipeline/crawl.ts";
import { itemsNamespaceFor, ProcessOutcome, processRawItem } from "#src/pipeline/process.ts";
import { type RawItem } from "#src/pipeline/types.ts";
import { loadActiveSources, loadCompetitors } from "#src/registry/read.ts";
import { Relationship, SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";

const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS = 900_000;
const SEEN_QUERY_CHUNK = 200;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls a Firecrawl batch job to completion; one throw covers failure and deadline. */
const pollUntilDone = async (jobId: string, deadlineMs: number): Promise<BatchResults> => {
  const results = await getBatchResults(jobId);
  if (results.status === BATCH_STATUS_COMPLETED) {
    return results;
  }
  const timedOut = Date.now() > deadlineMs;
  if (results.status === BATCH_STATUS_FAILED || timedOut) {
    throw new Error(
      results.status === BATCH_STATUS_FAILED
        ? `Firecrawl batch ${jobId} failed`
        : `Firecrawl batch ${jobId} did not complete within ${String(POLL_TIMEOUT_MS)}ms`
    );
  }
  await sleep(POLL_INTERVAL_MS);
  return pollUntilDone(jobId, deadlineMs);
};

type MatchedPage = { page: CrawlPageResult; source: SourceRecord };

const isMatchedPage = (value: MatchedPage | null): value is MatchedPage => value !== null;

type MatchResult = { matched: MatchedPage[]; unmatchedUrls: string[] };

/** Matches result pages to registered sources by exact URL — no fuzzy matching. */
const matchPages = (pages: CrawlPageResult[], sourcesByUrl: Record<string, SourceRecord>): MatchResult => {
  const attempted = R.map((page: CrawlPageResult): MatchedPage | null => {
    const source = sourcesByUrl[page.url];
    return source === undefined ? null : { page, source };
  }, pages);
  const matched = R.filter(isMatchedPage, attempted);
  const matchedUrls = new Set(R.map((m: MatchedPage) => m.page.url, matched));
  const unmatchedUrls = R.map(
    (page: CrawlPageResult) => page.url,
    R.reject((page: CrawlPageResult) => matchedUrls.has(page.url), pages)
  );
  return { matched, unmatchedUrls };
};

type ItemWithMeta = { item: RawItem; source: SourceRecord; isNew: boolean };

const isItemWithMeta = (value: ItemWithMeta | null): value is ItemWithMeta => value !== null;

const relationshipFor = (source: SourceRecord, relationshipByName: Record<string, Relationship>): Relationship =>
  source.competitor.length === 0
    ? Relationship.Regulatory
    : relationshipByName[source.competitor] ?? Relationship.Displace;

/** Builds RawItems for changed/new pages via crawlRawItem; same/removed pages drop out (null). */
const buildItemsWithMeta = (
  matched: MatchedPage[],
  relationshipByName: Record<string, Relationship>,
  nowIso: string
): ItemWithMeta[] => {
  const attempted = R.map((matchedPage: MatchedPage): ItemWithMeta | null => {
    const relationship = relationshipFor(matchedPage.source, relationshipByName);
    const item = crawlRawItem({ source: matchedPage.source, relationship, page: matchedPage.page, nowIso });
    const isNew = matchedPage.page.changeStatus === ChangeStatus.New;
    return item === null ? null : { item, source: matchedPage.source, isNew };
  }, matched);
  return R.filter(isItemWithMeta, attempted);
};

const seenUrlsForVertical = async (vertical: Vertical, urls: string[]): Promise<Set<string>> => {
  if (urls.length === 0) {
    return new Set();
  }
  const namespace = itemsNamespaceFor(vertical);
  const chunks = R.splitEvery(SEEN_QUERY_CHUNK, urls);
  const rowChunks = await sequentially(chunks, (chunk) =>
    queryRows({ namespace, filters: ["url", "In", chunk], topK: chunk.length, includeAttributes: ["url"] })
  );
  return new Set(R.map((row) => String(row["url"]), R.flatten(rowChunks)));
};

/** Changed pages always process; new pages are dropped if the URL is already stored. */
const dropSeenNewItems = async (newItems: ItemWithMeta[]): Promise<{ kept: ItemWithMeta[]; alreadySeen: number }> => {
  const grouped = R.groupBy((meta: ItemWithMeta) => meta.item.vertical, newItems);
  const verticals = Object.keys(grouped) as Vertical[];
  const perVertical = await sequentially(verticals, async (vertical) => {
    const metas = grouped[vertical] ?? [];
    const seen = await seenUrlsForVertical(vertical, R.map((meta: ItemWithMeta) => meta.item.url, metas));
    return R.reject((meta: ItemWithMeta) => seen.has(meta.item.url), metas);
  });
  const kept = R.flatten(perVertical);
  return { kept, alreadySeen: newItems.length - kept.length };
};

type ProcessResult = { outcome: ProcessOutcome | null; failure: string };

const processItem = async (meta: ItemWithMeta): Promise<ProcessResult> => {
  try {
    const outcome = await processRawItem(meta.item);
    return { outcome, failure: "" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { outcome: null, failure: `${meta.source.name}: ${detail}` };
  }
};

type SummaryInput = {
  totalPages: number;
  unmatchedCount: number;
  changed: number;
  newCount: number;
  unchangedOrRemoved: number;
  alreadySeen: number;
  stored: number;
  merged: number;
  failures: string[];
};

const summarize = (input: SummaryInput): string => {
  const unmatchedLine =
    input.unmatchedCount > 0 ? [`${String(input.unmatchedCount)} pages did not match a registered source.`] : [];
  const failureLines = R.map((failure: string) => `⚠️ ${failure}`, input.failures);
  const headline =
    `🕸️ Aggie crawl: ${String(input.totalPages)} pages checked — ${String(input.changed)} changed, ` +
    `${String(input.newCount)} new (${String(input.alreadySeen)} of them already seen), ` +
    `${String(input.unchangedOrRemoved)} unchanged/removed; ` +
    `stored ${String(input.stored)}, merged ${String(input.merged)}.`;
  return [headline, ...unmatchedLine, ...failureLines].join("\n");
};

const main = async (): Promise<void> => {
  const sources = await loadActiveSources(SourceKind.Crawl);
  if (sources.length === 0) {
    const note = "📭 Aggie crawl: no active crawl sources — nothing to check.";
    console.log(note);
    await postMessage(SlackChannel.IntelStaging, note);
    return;
  }
  const credits = await remainingCredits();
  if (credits < sources.length) {
    throw new Error(
      `Firecrawl credits insufficient for crawl: ${String(credits)} remaining, ` +
        `${String(sources.length)} pages need checking`
    );
  }
  const competitors = await loadCompetitors();
  const relationshipByName = R.fromPairs(
    R.map((competitor) => [competitor.name, competitor.relationship] as [string, Relationship], competitors)
  );
  const jobId = await startChangeTrackingBatch(R.map((source: SourceRecord) => source.url, sources));
  const results = await pollUntilDone(jobId, Date.now() + POLL_TIMEOUT_MS);
  const sourcesByUrl = R.indexBy(R.prop("url"), sources);
  const { matched, unmatchedUrls } = matchPages(results.pages, sourcesByUrl);
  if (unmatchedUrls.length > 0) {
    console.log(`Crawl pages with no matching registered source: ${unmatchedUrls.join(", ")}`);
  }
  const itemsWithMeta = buildItemsWithMeta(matched, relationshipByName, new Date().toISOString());
  const newItems = R.filter((meta: ItemWithMeta) => meta.isNew, itemsWithMeta);
  const changedItems = R.reject((meta: ItemWithMeta) => meta.isNew, itemsWithMeta);
  const { kept, alreadySeen } = await dropSeenNewItems(newItems);
  const processed = await sequentially([...kept, ...changedItems], processItem);
  const failures = R.reject(R.isEmpty, R.map((p: ProcessResult) => p.failure, processed));
  const changedCount = R.count((m: MatchedPage) => m.page.changeStatus === ChangeStatus.Changed, matched);
  const newCount = R.count((m: MatchedPage) => m.page.changeStatus === ChangeStatus.New, matched);
  const summary = summarize({
    totalPages: results.pages.length,
    unmatchedCount: unmatchedUrls.length,
    changed: changedCount,
    newCount,
    unchangedOrRemoved: matched.length - changedCount - newCount,
    alreadySeen,
    stored: R.count((p: ProcessResult) => p.outcome === ProcessOutcome.Stored, processed),
    merged: R.count((p: ProcessResult) => p.outcome === ProcessOutcome.Merged, processed),
    failures
  });
  console.log(summary);
  await postMessage(SlackChannel.IntelStaging, summary);
};

await main().catch(async (error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`aggie crawl failed: ${detail}`);
  process.exitCode = 1;
  await postMessage(SlackChannel.IntelStaging, `❌ aggie crawl failed: ${detail}`).catch(() => undefined);
});
