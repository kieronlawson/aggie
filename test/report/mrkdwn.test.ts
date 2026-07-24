import { describe, expect, it } from "vitest";

import { toMrkdwn } from "#src/report/mrkdwn.ts";

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
