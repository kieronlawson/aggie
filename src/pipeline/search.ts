import * as R from "ramda";

import { type SearchNewsResult } from "#src/clients/firecrawl.ts";
import { isOriginatingDomain } from "#src/pipeline/canonical.ts";
import { type RawItem } from "#src/pipeline/types.ts";
import { Relationship, type SourceRecord } from "#src/registry/types.ts";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const DAYS_PER_WEEK = 7;
const WEEK_MS = DAYS_PER_WEEK * DAY_MS;
const SEARCH_MAX_AGE_DAYS = 14;

const RELATIVE_DATE_PATTERN = /^(\d+)\s+(minute|hour|day|week)s?\s+ago$/iu;
const UNIT_MATCH_GROUP = 2;

const UNIT_MS: Record<string, number> = {
  minute: MINUTE_MS,
  hour: HOUR_MS,
  day: DAY_MS,
  week: WEEK_MS
};

/**
 * Resolves a search result's date (ISO-ish or relative "3 days ago") to ISO.
 * Returns "" for unusable dates — undated results are dropped rather than
 * stamped fresh, so stale articles cannot leak into the weekly window.
 */
const searchPublishedAt = (raw: string, nowMs: number): string => {
  const relative = RELATIVE_DATE_PATTERN.exec(raw.trim());
  if (relative !== null) {
    const count = Number(relative[1]);
    const unit = (relative[UNIT_MATCH_GROUP] ?? "").toLowerCase();
    return new Date(nowMs - count * (UNIT_MS[unit] ?? DAY_MS)).toISOString();
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString();
};

type SearchItemOpts = {
  source: SourceRecord;
  result: SearchNewsResult;
  nowMs: number;
};

enum SearchDrop {
  NoUrl = "no-url",
  Social = "social",
  Listing = "listing",
  Undated = "undated",
  Stale = "stale"
}

/** Social posts surface in web search results but are never citable articles. */
const SOCIAL_DOMAINS = ["facebook.com", "instagram.com", "linkedin.com", "x.com", "twitter.com", "tiktok.com", "youtube.com"];

const LISTING_QUERY_PARAMS = ["page", "_wrapper_format"];
const INDEX_PATH_PATTERN = /\/index\.html?$/u;
const ROOT_PATH = "/";

/** True for listing/index/pagination pages — navigation surfaces, not articles. */
const isListingUrl = (url: string): boolean => {
  const parsed = URL.parse(url);
  if (parsed === null) {
    return false;
  }
  const hasListingParam = R.any((param: string) => parsed.searchParams.has(param), LISTING_QUERY_PARAMS);
  return hasListingParam || parsed.pathname === ROOT_PATH || INDEX_PATH_PATTERN.test(parsed.pathname);
};

/** URL-shape drops: missing, social post, or listing page. */
const urlDrop = (url: string): SearchDrop | null => {
  if (!url.startsWith("http")) {
    return SearchDrop.NoUrl;
  }
  if (isOriginatingDomain(url, SOCIAL_DOMAINS)) {
    return SearchDrop.Social;
  }
  return isListingUrl(url) ? SearchDrop.Listing : null;
};

/** Maps a search result to a RawItem for P, or the reason it was dropped. */
const searchRawItem = ({ source, result, nowMs }: SearchItemOpts): RawItem | SearchDrop => {
  const url = result.url ?? "";
  const drop = urlDrop(url);
  if (drop !== null) {
    return drop;
  }
  const publishedAt = searchPublishedAt(result.date ?? "", nowMs);
  if (publishedAt.length === 0) {
    return SearchDrop.Undated;
  }
  if (Date.parse(publishedAt) < nowMs - SEARCH_MAX_AGE_DAYS * DAY_MS) {
    return SearchDrop.Stale;
  }
  const title = (result.title ?? "").trim();
  const snippet = (result.snippet ?? "").trim();
  return {
    url,
    title: title.length > 0 ? title : "(untitled)",
    content: [title, snippet].filter((part) => part.length > 0).join("\n"),
    published_at: publishedAt,
    source: source.name,
    vertical: source.vertical,
    competitor: source.competitor,
    relationship: Relationship.Regulatory
  };
};

export { SEARCH_MAX_AGE_DAYS, SearchDrop, type SearchItemOpts, searchPublishedAt, searchRawItem };
