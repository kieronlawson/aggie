import { describe, expect, it } from "vitest";

import { appendStaticSections, MANUAL_CHECKS } from "#src/report/format.ts";

describe("appendStaticSections", () => {
  it("appends the manual-checks section and footer to the digest body", () => {
    const result = appendStaticSections("## New this week\n\nStuff happened.", []);
    expect(result).toContain("## New this week");
    expect(result.indexOf("Stuff happened")).toBeLessThan(result.indexOf("## Manual checks"));
    expect(result).toContain("G2");
    expect(result).toContain("Capterra");
    expect(result).toContain("LinkedIn");
    expect(result).toContain("## Footer");
  });

  it("lists failed sources in the footer when present", () => {
    const result = appendStaticSections("body", ["SEC press releases: HTTP 403"]);
    expect(result).toContain("SEC press releases: HTTP 403");
  });

  it("notes no failures when the list is empty", () => {
    const result = appendStaticSections("body", []);
    expect(result).toMatch(/no source failures/iu);
  });

  it("exposes manual check links", () => {
    expect(MANUAL_CHECKS.length).toBeGreaterThanOrEqual(3);
  });
});
