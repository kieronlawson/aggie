import * as R from "ramda";

import { remainingCredits, type ScrapedArticle, scrapeMarkdown } from "#src/clients/firecrawl.ts";
import { pacedSequentially } from "#src/lib/async.ts";
import { NEW_PAGE_CHARS } from "#src/pipeline/crawl.ts";
import { type RawItem } from "#src/pipeline/types.ts";

/**
 * Firecrawl's plan allows 11 scrape requests/min (observed in 429 bodies on
 * the 2026-08-05 live run); 6s spacing keeps retrieval safely at ~10/min.
 */
const SCRAPE_PACE_MS = 6_000;

/**
 * Swaps the item's content for the scraped article body. The source-supplied
 * title stays (scrape titles carry site chrome); a null scrape is the thin
 * fallback — the item flows on unchanged rather than being lost.
 */
const enrichRawItem = (item: RawItem, scrape: ScrapedArticle | null): RawItem =>
  scrape === null ? item : { ...item, content: scrape.markdown.slice(0, NEW_PAGE_CHARS) };

type RetrievedItem = { item: RawItem; failure: string };

const retrieveOne = async (item: RawItem): Promise<RetrievedItem> => {
  try {
    const scrape = await scrapeMarkdown(item.url);
    return { item: enrichRawItem(item, scrape), failure: "" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { item, failure: detail };
  }
};

type RetrievalResult = { items: RawItem[]; failures: string[] };

/** Retrieves the full article for every item, paced under the rate limit; failures fall back thin, never fatal. */
const retrieveArticles = async (items: RawItem[]): Promise<RetrievalResult> => {
  const retrieved = await pacedSequentially(items, retrieveOne, SCRAPE_PACE_MS);
  return {
    items: R.map((entry: RetrievedItem) => entry.item, retrieved),
    failures: R.reject(R.isEmpty, R.map((entry: RetrievedItem) => entry.failure, retrieved))
  };
};

/** True when remaining Firecrawl credits cover `count` article scrapes; zero needs no API call. */
const creditsCover = async (count: number): Promise<boolean> => count === 0 || (await remainingCredits()) >= count;

export { creditsCover, enrichRawItem, type RetrievalResult, retrieveArticles, SCRAPE_PACE_MS };
