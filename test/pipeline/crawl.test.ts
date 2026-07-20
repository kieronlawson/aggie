import { describe, expect, it } from "vitest";

import { ChangeStatus, type CrawlPageResult } from "#src/clients/firecrawl.ts";
import { CONTEXT_EXCERPT_CHARS, crawlRawItem, NEW_PAGE_CHARS } from "#src/pipeline/crawl.ts";
import { Relationship, SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";

const SOURCE: SourceRecord = {
  kind: SourceKind.Crawl,
  url: "https://www.ringcentral.com/office/plansandpricing.html",
  name: "RingCentral pricing",
  vertical: Vertical.Competitor,
  competitor: "RingCentral",
  active: true,
  added_at: "2026-07-17T00:00:00Z"
};

const page = (overrides: Partial<CrawlPageResult>): CrawlPageResult => ({
  url: SOURCE.url,
  title: "Plans and Pricing",
  markdown: "# Pricing\nStandard $30",
  changeStatus: ChangeStatus.Changed,
  diffText: "-Standard $25\n+Standard $30",
  ...overrides
});

const NOW = "2026-07-20T05:00:00Z";

describe("crawlRawItem", () => {
  it("returns null for same and removed pages", () => {
    expect(
      crawlRawItem({
        source: SOURCE,
        relationship: Relationship.Displace,
        page: page({ changeStatus: ChangeStatus.Same }),
        nowIso: NOW
      })
    ).toBeNull();
    expect(
      crawlRawItem({
        source: SOURCE,
        relationship: Relationship.Displace,
        page: page({ changeStatus: ChangeStatus.Removed }),
        nowIso: NOW
      })
    ).toBeNull();
  });

  it("builds a diff+context item for changed pages", () => {
    const item = crawlRawItem({
      source: SOURCE,
      relationship: Relationship.Displace,
      page: page({}),
      nowIso: NOW
    });
    expect(item?.title).toBe("RingCentral pricing — page updated");
    expect(item?.content).toContain("+Standard $30");
    expect(item?.content).toContain("# Pricing");
    expect(item?.url).toBe(SOURCE.url);
    expect(item?.published_at).toBe(NOW);
    expect(item?.relationship).toBe(Relationship.Displace);
    expect(item?.source).toBe("RingCentral pricing");
  });

  it("uses the page markdown (truncated) for new pages and prefers the page title", () => {
    const long = "x".repeat(NEW_PAGE_CHARS + 100);
    const item = crawlRawItem({
      source: SOURCE,
      relationship: Relationship.Displace,
      page: page({ changeStatus: ChangeStatus.New, markdown: long }),
      nowIso: NOW
    });
    expect(item?.title).toBe("Plans and Pricing");
    expect(item?.content.length).toBe(NEW_PAGE_CHARS);
  });

  it("truncates the changed-page context excerpt", () => {
    const long = "y".repeat(CONTEXT_EXCERPT_CHARS + 500);
    const item = crawlRawItem({
      source: SOURCE,
      relationship: Relationship.Displace,
      page: page({ markdown: long }),
      nowIso: NOW
    });
    expect(item?.content.length).toBeLessThan(long.length);
  });

  it("falls back to the source name when a new page has no title", () => {
    const item = crawlRawItem({
      source: SOURCE,
      relationship: Relationship.Displace,
      page: page({ changeStatus: ChangeStatus.New, title: "" }),
      nowIso: NOW
    });
    expect(item?.title).toBe("RingCentral pricing");
  });
});
