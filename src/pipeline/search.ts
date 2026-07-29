import { type SearchNewsResult } from "#src/clients/firecrawl.ts";
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

/** Maps a search result to a RawItem for P; null = drop (no URL, undated, or stale). */
const searchRawItem = ({ source, result, nowMs }: SearchItemOpts): RawItem | null => {
  const url = result.url ?? "";
  if (!url.startsWith("http")) {
    return null;
  }
  const publishedAt = searchPublishedAt(result.date ?? "", nowMs);
  if (publishedAt.length === 0) {
    return null;
  }
  if (Date.parse(publishedAt) < nowMs - SEARCH_MAX_AGE_DAYS * DAY_MS) {
    return null;
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

export { SEARCH_MAX_AGE_DAYS, type SearchItemOpts, searchPublishedAt, searchRawItem };
