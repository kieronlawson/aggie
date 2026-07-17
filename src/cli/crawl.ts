import { ChangeStatus, runBatchScrape, type ScrapedPage } from "../clients/firecrawl.js";
import { Relationship, SourceKind } from "../config.js";
import { mapSeries } from "../lib/async.js";
import { nowSeconds } from "../lib/time.js";
import { activeSourcesByKind, listCompetitors } from "../registry/store.js";
import type { Competitor, Source } from "../registry/types.js";
import { seenUrls } from "../pipeline/items.js";
import { ProcessOutcome, processRawItem } from "../pipeline/process.js";
import type { RawItem } from "../pipeline/types.js";
import { postFailures, postRunSummary } from "./runlog.js";

const normalizeUrl = (url: string): string => url.replace(/\/+$/, "").toLowerCase();

const sourceForPage = (sources: readonly Source[], page: ScrapedPage): Source | undefined =>
  sources.find((source) => normalizeUrl(source.url) === normalizeUrl(page.url));

const relationshipFor = (source: Source, competitors: readonly Competitor[]): Relationship => {
  if (source.competitor === "") {
    return Relationship.Regulatory;
  }
  const match = competitors.find(
    (competitor) => competitor.name.toLowerCase() === source.competitor.toLowerCase()
  );
  return match?.relationship ?? Relationship.Displace;
};

const toRawItem = (source: Source, page: ScrapedPage, relationship: Relationship): RawItem => ({
  url: page.url,
  sourceId: source.id,
  sourceKind: SourceKind.Crawl,
  vertical: source.vertical,
  competitor: source.competitor,
  relationship,
  title: page.title,
  content: page.markdown,
  publishedAt: nowSeconds(),
  diff: page.changeStatus === ChangeStatus.Changed ? page.diff : ""
});

type PageDecision = { page: ScrapedPage; source: Source; action: "process" | "skip" };

const decidePage = async (sources: readonly Source[], page: ScrapedPage): Promise<PageDecision | undefined> => {
  const source = sourceForPage(sources, page);
  if (source === undefined || page.markdown === "") {
    return undefined;
  }
  if (page.changeStatus === ChangeStatus.Same || page.changeStatus === ChangeStatus.Removed) {
    return { page, source, action: "skip" };
  }
  if (page.changeStatus === ChangeStatus.Changed) {
    return { page, source, action: "process" };
  }
  const seen = await seenUrls(source.vertical, [page.url]);
  return { page, source, action: seen.has(page.url) ? "skip" : "process" };
};

const main = async (): Promise<void> => {
  const sources = await activeSourcesByKind([SourceKind.Crawl]);
  const competitors = await listCompetitors();
  if (sources.length === 0) {
    console.log("No crawl sources registered");
    return;
  }
  const pages = await runBatchScrape(sources.map((source) => source.url));
  const decisions = await mapSeries(pages, (page) => decidePage(sources, page));
  const actionable = decisions.filter(
    (decision): decision is PageDecision => decision !== undefined && decision.action === "process"
  );
  const outcomes = await mapSeries(actionable, (decision) =>
    processRawItem(toRawItem(decision.source, decision.page, relationshipFor(decision.source, competitors)))
  );

  const returnedUrls = new Set(pages.map((page) => normalizeUrl(page.url)));
  const missing = sources.filter((source) => !returnedUrls.has(normalizeUrl(source.url)));
  const stored = outcomes.filter(
    (outcome) => outcome === ProcessOutcome.Stored || outcome === ProcessOutcome.StoredSameStory
  ).length;

  const summary = [
    `crawl — ${sources.length} pages requested, ${pages.length} returned, ${actionable.length} new/changed, ${stored} stored`
  ];
  console.log(summary.join("\n"));
  await postRunSummary("w2-crawl", summary);
  await postFailures(
    "w2-crawl",
    missing.map((source) => ({ label: source.url, error: "no result returned by Firecrawl" }))
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
