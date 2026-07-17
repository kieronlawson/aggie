import { describe, expect, it } from "vitest";
import { collapseWhitespace, normalizeForHash, stripHtml } from "../src/pipeline/normalize.js";

describe("stripHtml", () => {
  it("removes tags and decodes common entities", () => {
    expect(stripHtml("<p>Fined&nbsp;$35 &amp; more</p>")).toContain("Fined");
    expect(stripHtml("<p>a &amp; b</p>")).toContain("&");
  });

  it("drops script and style bodies", () => {
    expect(stripHtml("<script>evil()</script><p>ok</p>")).not.toContain("evil");
  });
});

describe("normalizeForHash", () => {
  it("is stable across markup, case, whitespace and entity differences", () => {
    const origin = normalizeForHash("<article><p>RingCentral grew 9%  year over year.</p></article>");
    const syndicated = normalizeForHash("<div>\n\n<p>\nRINGCENTRAL grew 9&#37; year over year.\n</p>\n</div>");
    expect(origin).toBe(syndicated);
  });

  it("strips URLs so tracking params do not change the hash", () => {
    const a = normalizeForHash("Read more at https://x.com/a?utm=1 now");
    const b = normalizeForHash("Read more at https://x.com/a?utm=2 now");
    expect(a).toBe(b);
  });
});

describe("collapseWhitespace", () => {
  it("collapses runs of whitespace", () => {
    expect(collapseWhitespace("a\n\n  b\t c")).toBe("a b c");
  });
});
