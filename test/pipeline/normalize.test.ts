import { describe, expect, it } from "vitest";

import { contentHash, normalizeContent } from "#src/pipeline/normalize.ts";

describe("normalizeContent", () => {
  it("strips HTML tags and collapses whitespace", () => {
    const input = "<p>The SEC   today announced\n\n<b>charges</b> against a firm.</p>";
    expect(normalizeContent(input)).toBe("the sec today announced charges against a firm.");
  });

  it("decodes common HTML entities", () => {
    expect(normalizeContent("Records &amp; retention &#8212; a &quot;win&quot;")).toBe(
      `records & retention — a "win"`
    );
  });

  it("lowercases and trims so cosmetic differences hash identically", () => {
    const a = "  The SEC Today Announced charges.  ";
    const b = "the sec today announced charges.";
    expect(normalizeContent(a)).toBe(normalizeContent(b));
  });

  it("returns empty string for empty or tag-only input", () => {
    expect(normalizeContent("")).toBe("");
    expect(normalizeContent("<div><br/></div>")).toBe("");
  });
});

describe("contentHash", () => {
  it("is stable for identical normalized content", () => {
    expect(contentHash("same text")).toBe(contentHash("same text"));
  });

  it("differs for different content and looks like sha256 hex", () => {
    expect(contentHash("a")).not.toBe(contentHash("b"));
    expect(contentHash("a")).toMatch(/^[0-9a-f]{64}$/);
  });
});
