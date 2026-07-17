import { XMLParser } from "fast-xml-parser";
import { fetchText } from "../lib/http.js";
import { nowSeconds, parseDateSeconds } from "../lib/time.js";

export type FeedEntry = {
  url: string;
  title: string;
  content: string;
  publishedAt: number;
};

const FETCH_HEADERS: Record<string, string> = {
  "user-agent": "aggie-intel-aggregator/0.1 (internal tool; kieron@spokephone.com)",
  accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "item" || name === "entry" || name === "link",
  processEntities: true
});

type XmlNode = Record<string, unknown>;

const textOf = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return textOf(value[0]);
  }
  if (typeof value === "object" && value !== null) {
    return textOf((value as XmlNode)["#text"] ?? (value as XmlNode)["@_href"] ?? "");
  }
  return "";
};

const atomLinkHref = (links: unknown): string => {
  const list = Array.isArray(links) ? (links as XmlNode[]) : [];
  const alternate = list.find((link) => link["@_rel"] === undefined || link["@_rel"] === "alternate");
  return textOf(alternate?.["@_href"] ?? list[0]?.["@_href"] ?? "");
};

const rssEntry = (item: XmlNode, fallbackDate: number): FeedEntry => ({
  url: textOf(item.link ?? item.guid),
  title: textOf(item.title),
  content: textOf(item["content:encoded"] ?? item.description ?? item.title),
  publishedAt: parseDateSeconds(textOf(item.pubDate ?? item["dc:date"]), fallbackDate)
});

const atomEntry = (entry: XmlNode, fallbackDate: number): FeedEntry => ({
  url: atomLinkHref(entry.link),
  title: textOf(entry.title),
  content: textOf(entry.content ?? entry.summary ?? entry.title),
  publishedAt: parseDateSeconds(textOf(entry.published ?? entry.updated), fallbackDate)
});

export const parseFeed = (xml: string): FeedEntry[] => {
  const fallbackDate = nowSeconds();
  const doc = parser.parse(xml) as XmlNode;
  const rss = doc.rss as XmlNode | undefined;
  const channel = rss?.channel as XmlNode | undefined;
  const rssItems = (channel?.item as XmlNode[] | undefined) ?? [];
  const feed = doc.feed as XmlNode | undefined;
  const atomEntries = (feed?.entry as XmlNode[] | undefined) ?? [];
  const entries = [
    ...rssItems.map((item) => rssEntry(item, fallbackDate)),
    ...atomEntries.map((entry) => atomEntry(entry, fallbackDate))
  ];
  return entries.filter((entry) => entry.url !== "");
};

export const fetchFeed = async (url: string): Promise<FeedEntry[]> => {
  const xml = await fetchText(url, FETCH_HEADERS);
  return parseFeed(xml);
};
