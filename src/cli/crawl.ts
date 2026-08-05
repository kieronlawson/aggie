import * as R from "ramda";

import {
  BATCH_STATUS_COMPLETED,
  BATCH_STATUS_FAILED,
  type BatchResults,
  ChangeStatus,
  type CrawlPageResult,
  getBatchResults,
  remainingCredits,
  type ScrapedArticle,
  scrapeMarkdown,
  type SearchNewsResult,
  searchRecent,
  type SearchWebResult,
  startChangeTrackingBatch
} from "#src/clients/firecrawl.ts";
import { postMessage, SlackChannel } from "#src/clients/slack.ts";
import { sequentially } from "#src/lib/async.ts";
import { crawlRawItem } from "#src/pipeline/crawl.ts";
import { creditsCover, retrieveArticles } from "#src/pipeline/enrich.ts";
import { articleRawItem, type CandidateLink, newSameHostLinks } from "#src/pipeline/expand.ts";
import { ProcessOutcome, processRawItem, seenItemUrls } from "#src/pipeline/process.ts";
import { SearchDrop, searchRawItem } from "#src/pipeline/search.ts";
import { type RawItem } from "#src/pipeline/types.ts";
import { loadActiveSources, loadCompetitors } from "#src/registry/read.ts";
import { Relationship, SourceKind, type SourceRecord } from "#src/registry/types.ts";

const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS = 900_000;

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

/** Changed pages always process; new pages are dropped if the URL is already stored. */
const dropSeenNewItems = async (newItems: ItemWithMeta[]): Promise<{ kept: ItemWithMeta[]; alreadySeen: number }> => {
  const seen = await seenItemUrls(R.map((meta: ItemWithMeta) => meta.item.url, newItems));
  const kept = R.reject((meta: ItemWithMeta) => seen.has(meta.item.url), newItems);
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

type PageLinks = { meta: ItemWithMeta; links: CandidateLink[]; overflow: number };

/** Changed pages whose diff added same-host links — index pages with new stories behind them. */
const pageCandidates = (changed: ItemWithMeta[]): PageLinks[] =>
  R.filter(
    (page: PageLinks) => page.links.length > 0,
    R.map((meta: ItemWithMeta): PageLinks => {
      const { links, overflow } = newSameHostLinks(meta.item.diff_text ?? "", meta.item.url);
      return { meta, links, overflow };
    }, changed)
  );

type ScrapeAttempt = { link: CandidateLink; scrape: ScrapedArticle | null; failure: string };

const isScrapeSuccess = (attempt: ScrapeAttempt): attempt is ScrapeAttempt & { scrape: ScrapedArticle } =>
  attempt.scrape !== null;

const attemptScrape = async (link: CandidateLink): Promise<ScrapeAttempt> => {
  try {
    return { link, scrape: await scrapeMarkdown(link.url), failure: "" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { link, scrape: null, failure: detail };
  }
};

type PageExpansion = {
  pageUrl: string;
  articles: ItemWithMeta[];
  suppressed: boolean;
  failures: string[];
};

/**
 * Scrapes each fresh linked article into its own item. The page's diff item is
 * suppressed only when every fresh link scraped — any failure keeps the diff
 * item so the signal is never lost. Zero fresh links (all already stored) also
 * suppresses: the stories are covered, the index rotation itself is noise.
 */
const expandPage = async (page: PageLinks, seen: Set<string>, nowIso: string): Promise<PageExpansion> => {
  const freshLinks = R.reject((link: CandidateLink) => seen.has(link.url), page.links);
  const attempts = await sequentially(freshLinks, attemptScrape);
  const articles = R.map(
    (attempt: ScrapeAttempt & { scrape: ScrapedArticle }): ItemWithMeta => ({
      item: articleRawItem({
        source: page.meta.source,
        relationship: page.meta.item.relationship,
        link: attempt.link,
        scrape: attempt.scrape,
        nowIso
      }),
      source: page.meta.source,
      isNew: false
    }),
    R.filter(isScrapeSuccess, attempts)
  );
  const failures = R.map(
    (attempt: ScrapeAttempt) => `${page.meta.source.name}: expansion scrape failed — ${attempt.failure}`,
    R.reject(isScrapeSuccess, attempts)
  );
  return { pageUrl: page.meta.item.url, articles, suppressed: failures.length === 0, failures };
};

type ExpansionResult = {
  articles: ItemWithMeta[];
  suppressedUrls: string[];
  warnings: string[];
};

const NO_EXPANSION: ExpansionResult = { articles: [], suppressedUrls: [], warnings: [] };

const overflowWarnings = (pages: PageLinks[]): string[] =>
  R.map(
    (page: PageLinks) =>
      `${page.meta.source.name}: ${String(page.overflow)} expansion links over the per-page cap dropped`,
    R.filter((page: PageLinks) => page.overflow > 0, pages)
  );

/** Index expansion for changed pages; insufficient credits = no expansion, diff items flow as before. */
const expandChangedPages = async (changed: ItemWithMeta[], nowIso: string): Promise<ExpansionResult> => {
  const pages = pageCandidates(changed);
  if (pages.length === 0) {
    return NO_EXPANSION;
  }
  const allUrls = R.uniq(R.chain((page: PageLinks) => R.map((link: CandidateLink) => link.url, page.links), pages));
  const seen = await seenItemUrls(allUrls);
  const covered = await creditsCover(R.length(R.reject((url: string) => seen.has(url), allUrls)));
  if (!covered) {
    const skipped = `credits low — index expansion skipped for ${String(pages.length)} changed pages`;
    return { ...NO_EXPANSION, warnings: [...overflowWarnings(pages), skipped] };
  }
  const expansions = await sequentially(pages, (page) => expandPage(page, seen, nowIso));
  return {
    articles: R.chain((expansion: PageExpansion) => expansion.articles, expansions),
    suppressedUrls: R.map(
      (expansion: PageExpansion) => expansion.pageUrl,
      R.filter((expansion: PageExpansion) => expansion.suppressed, expansions)
    ),
    warnings: [...overflowWarnings(pages), ...R.chain((expansion: PageExpansion) => expansion.failures, expansions)]
  };
};

type SummaryInput = {
  totalPages: number;
  unmatchedCount: number;
  changed: number;
  newCount: number;
  unchangedOrRemoved: number;
  alreadySeen: number;
  expandedArticles: number;
  suppressedPages: number;
  stored: number;
  merged: number;
  failures: string[];
};

const summarize = (input: SummaryInput): string => {
  const unmatchedLine =
    input.unmatchedCount > 0 ? [`${String(input.unmatchedCount)} pages did not match a registered source.`] : [];
  const expansionLine =
    input.expandedArticles > 0 || input.suppressedPages > 0
      ? [
        `🔗 Expanded ${String(input.expandedArticles)} articles from changed index pages; ` +
            `${String(input.suppressedPages)} "page updated" items suppressed.`
      ]
      : [];
  const failureLines = R.map((failure: string) => `⚠️ ${failure}`, input.failures);
  const headline =
    `🕸️ Aggie crawl: ${String(input.totalPages)} pages checked — ${String(input.changed)} changed, ` +
    `${String(input.newCount)} new (${String(input.alreadySeen)} of them already seen), ` +
    `${String(input.unchangedOrRemoved)} unchanged/removed; ` +
    `stored ${String(input.stored)}, merged ${String(input.merged)}.`;
  return [headline, ...expansionLine, ...unmatchedLine, ...failureLines].join("\n");
};

const runCrawlStage = async (relationshipByName: Record<string, Relationship>): Promise<string> => {
  const sources = await loadActiveSources(SourceKind.Crawl);
  if (sources.length === 0) {
    return "📭 Aggie crawl: no active crawl sources — nothing to check.";
  }
  const credits = await remainingCredits();
  if (credits < sources.length) {
    throw new Error(
      `Firecrawl credits insufficient for crawl: ${String(credits)} remaining, ` +
        `${String(sources.length)} pages need checking`
    );
  }
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
  const expansion = await expandChangedPages(changedItems, new Date().toISOString());
  const suppressed = new Set(expansion.suppressedUrls);
  const emittedChanged = R.reject((meta: ItemWithMeta) => suppressed.has(meta.item.url), changedItems);
  const processed = await sequentially([...kept, ...emittedChanged, ...expansion.articles], processItem);
  const failures = R.reject(R.isEmpty, R.map((p: ProcessResult) => p.failure, processed));
  const changedCount = R.count((m: MatchedPage) => m.page.changeStatus === ChangeStatus.Changed, matched);
  const newCount = R.count((m: MatchedPage) => m.page.changeStatus === ChangeStatus.New, matched);
  return summarize({
    totalPages: results.pages.length,
    unmatchedCount: unmatchedUrls.length,
    changed: changedCount,
    newCount,
    unchangedOrRemoved: matched.length - changedCount - newCount,
    alreadySeen,
    expandedArticles: expansion.articles.length,
    suppressedPages: suppressed.size,
    stored: R.count((p: ProcessResult) => p.outcome === ProcessOutcome.Stored, processed),
    merged: R.count((p: ProcessResult) => p.outcome === ProcessOutcome.Merged, processed),
    failures: [...expansion.warnings, ...failures]
  });
};

const SEARCH_RESULT_LIMIT = 10;

type SearchOutcome = {
  fetched: number;
  noUrl: number;
  social: number;
  listing: number;
  undated: number;
  stale: number;
  alreadySeen: number;
  unseen: number;
  stored: number;
  merged: number;
  thin: number;
  warning: string;
  failure: string;
};

const EMPTY_SEARCH_OUTCOME: SearchOutcome = {
  fetched: 0,
  noUrl: 0,
  social: 0,
  listing: 0,
  undated: 0,
  stale: 0,
  alreadySeen: 0,
  unseen: 0,
  stored: 0,
  merged: 0,
  thin: 0,
  warning: "",
  failure: ""
};

type SearchRetrieval = { items: RawItem[]; thin: number; warning: string };

/** Full-article retrieval for fresh search items — title+snippet alone is not analysable text. */
const retrieveSearchItems = async (source: SourceRecord, unseen: RawItem[]): Promise<SearchRetrieval> => {
  const covered = await creditsCover(unseen.length);
  if (!covered) {
    return {
      items: unseen,
      thin: unseen.length,
      warning: `${source.name}: credits low — search retrieval skipped, ${String(unseen.length)} items thin`
    };
  }
  const { items, failures } = await retrieveArticles(unseen);
  const warning =
    failures.length > 0
      ? `${source.name}: ${String(failures.length)} article retrievals failed, kept thin (${failures[0] ?? ""})`
      : "";
  return { items, thin: failures.length, warning };
};

const isRawItem = (value: RawItem | SearchDrop): value is RawItem => typeof value !== "string";

/** Web results carry no date; tbs=qdr:w already bounds them to the past week, so stamp them now. */
const webAsDated = (web: SearchWebResult[], nowMs: number): SearchNewsResult[] =>
  R.map(
    (result: SearchWebResult) => ({
      title: result.title ?? "",
      url: result.url ?? "",
      snippet: result.description ?? "",
      date: new Date(nowMs).toISOString()
    }),
    web
  );

const searchSource = async (source: SourceRecord, nowMs: number): Promise<SearchOutcome> => {
  try {
    const { news, web } = await searchRecent(source.url, SEARCH_RESULT_LIMIT);
    const results = [...news, ...webAsDated(web, nowMs)];
    const mapped = R.map((result) => searchRawItem({ source, result, nowMs }), results);
    const drops = R.countBy(String, R.reject(isRawItem, mapped));
    const fresh = R.uniqBy((item: RawItem) => item.url, R.filter(isRawItem, mapped));
    const seen = await seenItemUrls(R.map((item: RawItem) => item.url, fresh));
    const unseen = R.reject((item: RawItem) => seen.has(item.url), fresh);
    const retrieval = await retrieveSearchItems(source, unseen);
    const outcomes = await sequentially(retrieval.items, processRawItem);
    return {
      ...EMPTY_SEARCH_OUTCOME,
      fetched: results.length,
      noUrl: drops[SearchDrop.NoUrl] ?? 0,
      social: drops[SearchDrop.Social] ?? 0,
      listing: drops[SearchDrop.Listing] ?? 0,
      undated: drops[SearchDrop.Undated] ?? 0,
      stale: drops[SearchDrop.Stale] ?? 0,
      alreadySeen: fresh.length - unseen.length,
      unseen: unseen.length,
      stored: R.count((outcome) => outcome === ProcessOutcome.Stored, outcomes),
      merged: R.count((outcome) => outcome === ProcessOutcome.Merged, outcomes),
      thin: retrieval.thin,
      warning: retrieval.warning
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ...EMPTY_SEARCH_OUTCOME, failure: `${source.name}: ${detail}` };
  }
};

const runSearchStage = async (): Promise<string> => {
  const sources = await loadActiveSources(SourceKind.Search);
  if (sources.length === 0) {
    return "";
  }
  const nowMs = Date.now();
  const outcomes = await sequentially(sources, (source) => searchSource(source, nowMs));
  const total = (key: keyof Omit<SearchOutcome, "failure" | "warning">): number =>
    R.sum(R.map((outcome: SearchOutcome) => outcome[key], outcomes));
  const warnings = R.reject(R.isEmpty, R.map((outcome: SearchOutcome) => outcome.warning, outcomes));
  const failures = R.reject(R.isEmpty, R.map((outcome: SearchOutcome) => outcome.failure, outcomes));
  const headline =
    `🔎 Aggie search: ${String(sources.length)} queries — ${String(total("fetched"))} results ` +
    `(${String(total("noUrl"))} no-url, ${String(total("social"))} social, ${String(total("listing"))} listing, ` +
    `${String(total("undated"))} undated, ${String(total("stale"))} stale, ` +
    `${String(total("alreadySeen"))} already seen), ${String(total("unseen"))} fresh/unseen; ` +
    `stored ${String(total("stored"))}, merged ${String(total("merged"))}, ${String(total("thin"))} thin.`;
  return [headline, ...R.map((line: string) => `⚠️ ${line}`, [...warnings, ...failures])].join("\n");
};

const main = async (): Promise<void> => {
  const competitors = await loadCompetitors();
  const relationshipByName = R.fromPairs(
    R.map((competitor) => [competitor.name, competitor.relationship] as [string, Relationship], competitors)
  );
  const crawlSummary = await runCrawlStage(relationshipByName);
  const searchSummary = await runSearchStage();
  const summary = R.reject(R.isEmpty, [crawlSummary, searchSummary]).join("\n");
  console.log(summary);
  await postMessage(SlackChannel.IntelStaging, summary);
};

await main().catch(async (error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`aggie crawl failed: ${detail}`);
  process.exitCode = 1;
  await postMessage(SlackChannel.IntelStaging, `❌ aggie crawl failed: ${detail}`).catch(() => undefined);
});
