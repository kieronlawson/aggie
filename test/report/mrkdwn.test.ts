import { describe, expect, it } from "vitest";

import { chunkForSlack, toMrkdwn } from "#src/report/mrkdwn.ts";

describe("toMrkdwn", () => {
  it("converts headings to bold lines", () => {
    expect(toMrkdwn("## New this week")).toBe("*New this week*");
    expect(toMrkdwn("### Sub")).toBe("*Sub*");
  });

  it("converts bold and links", () => {
    expect(toMrkdwn("**important** [SEC press release](https://sec.gov/x)")).toBe(
      "*important* <https://sec.gov/x|SEC press release>"
    );
  });

  it("converts markdown bullets to slack bullets", () => {
    expect(toMrkdwn("- first\n- second")).toBe("• first\n• second");
  });

  it("leaves bare URLs and plain text alone", () => {
    const text = "Plain text with https://example.com/a?b=1 inline.";
    expect(toMrkdwn(text)).toBe(text);
  });
});

describe("chunkForSlack", () => {
  it("keeps short text as a single chunk", () => {
    expect(chunkForSlack("*Header*\nshort body")).toEqual(["*Header*\nshort body"]);
  });

  it("splits long text at section boundaries, keeping each chunk under the limit", () => {
    const section = (title: string): string => `*${title}*\n${"x".repeat(2500)}`;
    const text = [section("A"), section("B"), section("C")].join("\n\n");
    const chunks = chunkForSlack(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 3800)).toBe(true);
    expect(chunks[0]).toContain("*A*");
    expect(chunks.join("\n\n")).toContain("*C*");
  });

  it("hard-splits a single oversized section rather than dropping content", () => {
    const text = `*Huge*\n${"word ".repeat(2000)}`;
    const chunks = chunkForSlack(text);
    expect(chunks.every((chunk) => chunk.length <= 3800)).toBe(true);
    expect(chunks.join("").replace(/\s+/gu, "")).toContain("word".repeat(3));
  });
});
