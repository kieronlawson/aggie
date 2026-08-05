import * as R from "ramda";

import { type ScrapedArticle } from "#src/clients/firecrawl.ts";
import { NEW_PAGE_CHARS } from "#src/pipeline/crawl.ts";
import { type RawItem } from "#src/pipeline/types.ts";
import { type Relationship, type SourceRecord } from "#src/registry/types.ts";

const MAX_EXPANDED_LINKS_PER_PAGE = 10;

type CandidateLink = { url: string; text: string };

/** Added diff lines start with a single "+" — "+++" is the file header. */
const ADDED_LINE_PATTERN = /^\+(?!\+\+)/u;
const MARKDOWN_LINK_PATTERN = /(!?)\[([^\]]*)\]\(([^)\s]+)\)/gu;
const BARE_URL_PATTERN = /https?:\/\/[^\s<>()"']+/gu;
const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?]+$/u;

const IMAGE_MARKER = "!";
const LINK_TEXT_GROUP = 2;
const LINK_URL_GROUP = 3;

const isCandidate = (value: CandidateLink | null): value is CandidateLink => value !== null;

const markdownLinks = (line: string): CandidateLink[] => {
  const mapped = R.map(
    (match: RegExpMatchArray): CandidateLink | null =>
      match[1] === IMAGE_MARKER
        ? null
        : { url: match[LINK_URL_GROUP] ?? "", text: (match[LINK_TEXT_GROUP] ?? "").trim() },
    Array.from(line.matchAll(MARKDOWN_LINK_PATTERN))
  );
  return R.filter(isCandidate, mapped);
};

/** Markdown-link spans are blanked first so their URLs are not double-counted as bare URLs. */
const bareUrls = (line: string): CandidateLink[] =>
  R.map(
    (match: RegExpMatchArray) => ({
      url: match[0].replace(TRAILING_PUNCTUATION_PATTERN, ""),
      text: ""
    }),
    Array.from(line.replace(MARKDOWN_LINK_PATTERN, " ").matchAll(BARE_URL_PATTERN))
  );

/** Resolves against the tracked page; drops unparsable, off-host, and self links. */
const resolvedCandidate = (candidate: CandidateLink, page: URL): CandidateLink | null => {
  const parsed = URL.parse(candidate.url, page.href);
  if (parsed === null) {
    return null;
  }
  const offHostOrSelf = parsed.host !== page.host || parsed.href === page.href;
  return offHostOrSelf ? null : { url: parsed.href, text: candidate.text };
};

type ExpandedLinks = { links: CandidateLink[]; overflow: number };

const NO_LINKS: ExpandedLinks = { links: [], overflow: 0 };

/**
 * Same-host article links added by a tracked page's diff — the stories behind
 * an index-page change. Deduped (first text wins) and capped; the overflow
 * count is returned so the caller can report it rather than truncate silently.
 */
const newSameHostLinks = (diffText: string, pageUrl: string): ExpandedLinks => {
  const page = URL.parse(pageUrl);
  if (page === null) {
    return NO_LINKS;
  }
  const added = R.filter((line: string) => ADDED_LINE_PATTERN.test(line), diffText.split("\n"));
  const candidates = R.chain((line: string) => [...markdownLinks(line), ...bareUrls(line)], added);
  const resolved = R.map((candidate: CandidateLink) => resolvedCandidate(candidate, page), candidates);
  const unique = R.uniqBy((link: CandidateLink) => link.url, R.filter(isCandidate, resolved));
  return {
    links: R.take(MAX_EXPANDED_LINKS_PER_PAGE, unique),
    overflow: Math.max(0, unique.length - MAX_EXPANDED_LINKS_PER_PAGE)
  };
};

const UNTITLED = "(untitled)";

type ArticleItemOpts = {
  source: SourceRecord;
  relationship: Relationship;
  link: CandidateLink;
  scrape: ScrapedArticle;
  nowIso: string;
};

/** One expanded article from an index page, attributed to the tracked source; no diff to carry. */
const articleRawItem = ({ source, relationship, link, scrape, nowIso }: ArticleItemOpts): RawItem => {
  const scrapeTitle = scrape.title.trim();
  const fallbackTitle = link.text.length > 0 ? link.text : UNTITLED;
  return {
    url: link.url,
    title: scrapeTitle.length > 0 ? scrapeTitle : fallbackTitle,
    content: scrape.markdown.slice(0, NEW_PAGE_CHARS),
    published_at: nowIso,
    source: source.name,
    vertical: source.vertical,
    competitor: source.competitor,
    relationship
  };
};

export {
  type ArticleItemOpts,
  articleRawItem,
  type CandidateLink,
  type ExpandedLinks,
  MAX_EXPANDED_LINKS_PER_PAGE,
  newSameHostLinks
};
