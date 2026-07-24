import { describe, expect, it } from "vitest";

import { SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";
import { appendStaticSections, MANUAL_CHECKS, quietSources } from "#src/report/format.ts";

const source = (overrides: Partial<SourceRecord> = {}): SourceRecord => ({
  kind: SourceKind.Feed,
  url: "https://example.com/feed.xml",
  name: "Example feed",
  vertical: Vertical.Finance,
  competitor: "",
  active: true,
  added_at: "2026-07-17T00:00:00Z",
  ...overrides
});

describe("appendStaticSections", () => {
  it("appends the manual-checks section and footer to the digest body", () => {
    const result = appendStaticSections("## New this week\n\nStuff happened.", []);
    expect(result).toContain("## New this week");
    expect(result.indexOf("Stuff happened")).toBeLessThan(result.indexOf("## 🔎 Manual checks"));
    expect(result).toContain("G2");
    expect(result).toContain("Capterra");
    expect(result).toContain("LinkedIn");
    expect(result).toContain("## Footer");
  });

  it("lists failed sources in the footer when present", () => {
    const result = appendStaticSections("body", ["SEC press releases: HTTP 403"]);
    expect(result).toContain("SEC press releases: HTTP 403");
  });

  it("notes every active source produced items when the list is empty", () => {
    const result = appendStaticSections("body", []);
    expect(result).toMatch(/every active source produced items this week/iu);
  });

  it("exposes manual check links", () => {
    expect(MANUAL_CHECKS.length).toBeGreaterThanOrEqual(3);
  });
});

describe("quietSources", () => {
  it("lists an active source with no items this week", () => {
    const sources = [source({ name: "SEC press releases" })];
    expect(quietSources(sources, [])).toEqual(["SEC press releases"]);
  });

  it("excludes a source that produced items this week", () => {
    const sources = [source({ name: "SEC press releases" })];
    expect(quietSources(sources, ["SEC press releases"])).toEqual([]);
  });

  it("never lists an inactive source", () => {
    const sources = [source({ name: "Retired feed", active: false })];
    expect(quietSources(sources, [])).toEqual([]);
  });
});
