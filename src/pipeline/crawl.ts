import { ChangeStatus, type CrawlPageResult } from "#src/clients/firecrawl.ts";
import { type RawItem } from "#src/pipeline/types.ts";
import { type Relationship, type SourceRecord } from "#src/registry/types.ts";

const CONTEXT_EXCERPT_CHARS = 4000;
const NEW_PAGE_CHARS = 20000;

type CrawlItemOpts = {
  source: SourceRecord;
  relationship: Relationship;
  page: CrawlPageResult;
  nowIso: string;
};

const changedContent = (page: CrawlPageResult): string =>
  [
    "This tracked page changed since the last weekly crawl. Diff (git style):",
    page.diffText,
    "",
    "Current page context (excerpt):",
    page.markdown.slice(0, CONTEXT_EXCERPT_CHARS)
  ].join("\n");

/** Maps a crawl result to a RawItem for P; null = nothing to process (same/removed). */
const crawlRawItem = (opts: CrawlItemOpts): RawItem | null => {
  const { source, relationship, page, nowIso } = opts;
  const skippable = page.changeStatus === ChangeStatus.Same || page.changeStatus === ChangeStatus.Removed;
  if (skippable) {
    return null;
  }
  const changed = page.changeStatus === ChangeStatus.Changed;
  const pageTitle = page.title.length > 0 ? page.title : source.name;
  return {
    url: page.url,
    title: changed ? `${source.name} — page updated` : pageTitle,
    content: changed ? changedContent(page) : page.markdown.slice(0, NEW_PAGE_CHARS),
    published_at: nowIso,
    source: source.name,
    vertical: source.vertical,
    competitor: source.competitor,
    relationship
  };
};

export { CONTEXT_EXCERPT_CHARS, type CrawlItemOpts, crawlRawItem, NEW_PAGE_CHARS };
