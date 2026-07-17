import Parser from "rss-parser";

import { type RawItem } from "#src/pipeline/types.ts";
import { type Relationship, type SourceRecord } from "#src/registry/types.ts";

/** sec.gov (and good citizenship elsewhere) requires a declared-contact UA. */
const CONTACT_USER_AGENT = "AggieIntel/0.1 (kieron@spokephone.com)";

const FEED_ACCEPT = "application/rss+xml, application/atom+xml, application/xml, text/xml, */*";

type FeedEntry = {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  "content:encoded"?: string;
};

const parser = new Parser({ customFields: { item: ["content:encoded"] } });

const parseFeedXml = async (xml: string): Promise<FeedEntry[]> => {
  const feed = await parser.parseString(xml);
  return feed.items;
};

const fetchFeedEntries = async (url: string): Promise<FeedEntry[]> => {
  const response = await fetch(url, {
    headers: { "User-Agent": CONTACT_USER_AGENT, Accept: FEED_ACCEPT },
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(`Feed fetch failed for ${url}: HTTP ${String(response.status)}`);
  }
  return parseFeedXml(await response.text());
};

const publishedIso = (entry: FeedEntry, fallbackIso: string): string => {
  const raw = entry.isoDate ?? entry.pubDate ?? "";
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? fallbackIso : new Date(ms).toISOString();
};

const entryContent = (entry: FeedEntry): string => {
  const candidates = [entry["content:encoded"], entry.content, entry.summary, entry.contentSnippet, entry.title];
  return candidates.find((candidate) => candidate !== undefined && candidate.trim().length > 0) ?? "";
};

const mapEntryToRawItem = (
  entry: FeedEntry,
  source: SourceRecord,
  relationship: Relationship,
  fallbackIso: string
): RawItem => ({
  url: entry.link ?? "",
  title: entry.title ?? "(untitled)",
  content: entryContent(entry),
  published_at: publishedIso(entry, fallbackIso),
  source: source.url,
  vertical: source.vertical,
  competitor: source.competitor,
  relationship
});

export { CONTACT_USER_AGENT, type FeedEntry, fetchFeedEntries, mapEntryToRawItem, parseFeedXml };
