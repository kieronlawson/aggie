import { describe, expect, it } from "vitest";

import { NEW_PAGE_CHARS } from "#src/pipeline/crawl.ts";
import { articleRawItem, MAX_EXPANDED_LINKS_PER_PAGE, newSameHostLinks } from "#src/pipeline/expand.ts";
import { Relationship, SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";

const PAGE_URL = "https://www.ringcentral.com/newsroom.html";

const SOURCE: SourceRecord = {
  kind: SourceKind.Crawl,
  url: PAGE_URL,
  name: "RingCentral newsroom",
  vertical: Vertical.Competitor,
  competitor: "RingCentral",
  active: true,
  added_at: "2026-07-17T00:00:00Z"
};

describe("newSameHostLinks", () => {
  it("extracts markdown links with their text from added lines", () => {
    const diff = "+ [RingCentral and OpenAI Collaborate](https://www.ringcentral.com/newsroom/openai.html)";
    const { links, overflow } = newSameHostLinks(diff, PAGE_URL);
    expect(links).toEqual([
      { url: "https://www.ringcentral.com/newsroom/openai.html", text: "RingCentral and OpenAI Collaborate" }
    ]);
    expect(overflow).toBe(0);
  });

  it("extracts bare URLs from added lines", () => {
    const diff = "+ New: https://www.ringcentral.com/newsroom/nice-partnership.html today";
    const { links } = newSameHostLinks(diff, PAGE_URL);
    expect(links).toEqual([{ url: "https://www.ringcentral.com/newsroom/nice-partnership.html", text: "" }]);
  });

  it("trims trailing punctuation from bare URLs", () => {
    const diff = "+ See https://www.ringcentral.com/newsroom/a.html.";
    const { links } = newSameHostLinks(diff, PAGE_URL);
    expect(links[0]?.url).toBe("https://www.ringcentral.com/newsroom/a.html");
  });

  it("ignores links on removed and context lines", () => {
    const diff = [
      "- [Old story](https://www.ringcentral.com/newsroom/old.html)",
      "  [Unchanged story](https://www.ringcentral.com/newsroom/unchanged.html)",
      "+ [New story](https://www.ringcentral.com/newsroom/new.html)"
    ].join("\n");
    const { links } = newSameHostLinks(diff, PAGE_URL);
    expect(links).toEqual([{ url: "https://www.ringcentral.com/newsroom/new.html", text: "New story" }]);
  });

  it("ignores +++ diff header lines", () => {
    const diff = "+++ b/https://www.ringcentral.com/newsroom/header.html";
    const { links } = newSameHostLinks(diff, PAGE_URL);
    expect(links).toEqual([]);
  });

  it("rejects links on a different host", () => {
    const diff = "+ [Off host](https://techcrunch.com/story.html)";
    const { links } = newSameHostLinks(diff, PAGE_URL);
    expect(links).toEqual([]);
  });

  it("resolves relative links against the tracked page URL", () => {
    const diff = "+ [Relative](/newsroom/relative.html)";
    const { links } = newSameHostLinks(diff, PAGE_URL);
    expect(links).toEqual([{ url: "https://www.ringcentral.com/newsroom/relative.html", text: "Relative" }]);
  });

  it("excludes the tracked page itself and image links", () => {
    const diff = [
      `+ [Self](${PAGE_URL})`,
      "+ ![Logo](https://www.ringcentral.com/images/logo.png)"
    ].join("\n");
    const { links } = newSameHostLinks(diff, PAGE_URL);
    expect(links).toEqual([]);
  });

  it("dedupes repeated URLs, keeping the first text", () => {
    const diff = [
      "+ [First text](https://www.ringcentral.com/newsroom/a.html)",
      "+ [Second text](https://www.ringcentral.com/newsroom/a.html)"
    ].join("\n");
    const { links } = newSameHostLinks(diff, PAGE_URL);
    expect(links).toEqual([{ url: "https://www.ringcentral.com/newsroom/a.html", text: "First text" }]);
  });

  it("caps links per page and reports the overflow", () => {
    const many = Array.from(
      { length: MAX_EXPANDED_LINKS_PER_PAGE + 3 },
      (_, i) => `+ [Story ${String(i)}](https://www.ringcentral.com/newsroom/story-${String(i)}.html)`
    ).join("\n");
    const { links, overflow } = newSameHostLinks(many, PAGE_URL);
    expect(links).toHaveLength(MAX_EXPANDED_LINKS_PER_PAGE);
    expect(overflow).toBe(3);
  });

  it("returns nothing for an empty diff", () => {
    expect(newSameHostLinks("", PAGE_URL)).toEqual({ links: [], overflow: 0 });
  });
});

const NOW = "2026-08-05T03:00:00.000Z";

describe("articleRawItem", () => {
  it("builds a RawItem from the scraped article with tracked-source attribution", () => {
    const item = articleRawItem({
      source: SOURCE,
      relationship: Relationship.Displace,
      link: { url: "https://www.ringcentral.com/newsroom/openai.html", text: "OpenAI collab" },
      scrape: { title: "RingCentral and OpenAI Collaborate", markdown: "# Full press release" },
      nowIso: NOW
    });
    expect(item).toEqual({
      url: "https://www.ringcentral.com/newsroom/openai.html",
      title: "RingCentral and OpenAI Collaborate",
      content: "# Full press release",
      published_at: NOW,
      source: "RingCentral newsroom",
      vertical: Vertical.Competitor,
      competitor: "RingCentral",
      relationship: Relationship.Displace
    });
    expect(item.diff_text).toBeUndefined();
  });

  it("falls back to the diff link text when the scrape has no title", () => {
    const item = articleRawItem({
      source: SOURCE,
      relationship: Relationship.Displace,
      link: { url: "https://www.ringcentral.com/newsroom/a.html", text: "Link text" },
      scrape: { title: " ", markdown: "body" },
      nowIso: NOW
    });
    expect(item.title).toBe("Link text");
  });

  it("marks the item untitled when neither scrape nor link has a title", () => {
    const item = articleRawItem({
      source: SOURCE,
      relationship: Relationship.Displace,
      link: { url: "https://www.ringcentral.com/newsroom/a.html", text: "" },
      scrape: { title: "", markdown: "body" },
      nowIso: NOW
    });
    expect(item.title).toBe("(untitled)");
  });

  it("truncates the article body to the new-page cap", () => {
    const item = articleRawItem({
      source: SOURCE,
      relationship: Relationship.Displace,
      link: { url: "https://www.ringcentral.com/newsroom/a.html", text: "t" },
      scrape: { title: "t", markdown: "b".repeat(NEW_PAGE_CHARS + 100) },
      nowIso: NOW
    });
    expect(item.content.length).toBe(NEW_PAGE_CHARS);
  });
});
