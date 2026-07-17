import { describe, expect, it } from "vitest";
import { parseFeed } from "../src/pipeline/feeds.js";
import { ATOM_FIXTURE, RSS_FIXTURE } from "./fixtures/feeds.js";

describe("parseFeed", () => {
  it("parses RSS items with links, titles, content and dates", () => {
    const entries = parseFeed(RSS_FIXTURE);
    expect(entries).toHaveLength(2);
    const [first] = entries;
    expect(first?.url).toBe("https://www.sec.gov/newsroom/press-releases/2026-102");
    expect(first?.title).toContain("Recordkeeping");
    expect(first?.publishedAt).toBeGreaterThan(0);
  });

  it("parses Atom entries and resolves alternate link href", () => {
    const entries = parseFeed(ATOM_FIXTURE);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toContain("edgar/data/1384905");
    expect(entries[0]?.title).toContain("10-Q");
  });

  it("returns an empty array for non-feed input", () => {
    expect(parseFeed("<html><body>not a feed</body></html>")).toEqual([]);
  });
});
