import { describe, expect, it } from "vitest";

import { NEW_PAGE_CHARS } from "#src/pipeline/crawl.ts";
import { enrichRawItem } from "#src/pipeline/enrich.ts";
import { type RawItem } from "#src/pipeline/types.ts";
import { Relationship, Vertical } from "#src/registry/types.ts";

const ITEM: RawItem = {
  url: "https://www.sec.gov/news/press-release/2026-100",
  title: "SEC Charges Firm Over Recordkeeping Failures",
  content: "Washington D.C. — The Securities and Exchange Commission today announced…",
  published_at: "2026-08-03T12:00:00.000Z",
  source: "SEC press releases",
  vertical: Vertical.Finance,
  competitor: "",
  relationship: Relationship.Regulatory
};

describe("enrichRawItem", () => {
  it("replaces content with the scraped article body", () => {
    const enriched = enrichRawItem(ITEM, { title: "SEC.gov | Press Release", markdown: "# Full article\nBody text" });
    expect(enriched.content).toBe("# Full article\nBody text");
  });

  it("keeps the source-supplied title — scrape titles carry site chrome", () => {
    const enriched = enrichRawItem(ITEM, { title: "SEC.gov | Press Release", markdown: "body" });
    expect(enriched.title).toBe(ITEM.title);
  });

  it("truncates the scraped body to the new-page cap", () => {
    const long = "a".repeat(NEW_PAGE_CHARS + 500);
    const enriched = enrichRawItem(ITEM, { title: "", markdown: long });
    expect(enriched.content.length).toBe(NEW_PAGE_CHARS);
  });

  it("falls back to the item unchanged when the scrape failed", () => {
    expect(enrichRawItem(ITEM, null)).toEqual(ITEM);
  });

  it("leaves every non-content field untouched", () => {
    const enriched = enrichRawItem(ITEM, { title: "x", markdown: "y" });
    expect(enriched).toEqual({ ...ITEM, content: "y" });
  });
});
