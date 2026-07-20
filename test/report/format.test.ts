import { describe, expect, it } from "vitest";

import { appendStaticSections, DETAILS_HEADING, MANUAL_CHECKS, splitDigest } from "#src/report/format.ts";

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

  it("notes no failures when the list is empty", () => {
    const result = appendStaticSections("body", []);
    expect(result).toMatch(/no source failures/iu);
  });

  it("exposes manual check links", () => {
    expect(MANUAL_CHECKS.length).toBeGreaterThanOrEqual(3);
  });
});

describe("splitDigest", () => {
  it("splits card from thread at the Details heading", () => {
    const body = "Lead-in.\n\n## ⚡ Signals\n\n- bullet\n\n## Details\n\nStory paragraph.\n\n## 🔁 Continuing stories\n\nNone.";
    const { card, thread } = splitDigest(body);
    expect(card).toContain("Lead-in.");
    expect(card).toContain("## ⚡ Signals");
    expect(card).not.toContain("## Details");
    expect(thread.startsWith(DETAILS_HEADING)).toBe(true);
    expect(thread).toContain("## 🔁 Continuing stories");
  });

  it("returns an empty card when the marker is missing", () => {
    const { card, thread } = splitDigest("just a body with no marker");
    expect(card).toBe("");
    expect(thread).toBe("just a body with no marker");
  });

  it("keeps static sections thread-side after appendStaticSections", () => {
    const digest = appendStaticSections("Lead.\n\n## Details\n\nStory.", []);
    const { card, thread } = splitDigest(digest);
    expect(card).not.toContain("Manual checks");
    expect(thread).toContain("## 🔎 Manual checks");
    expect(thread).toContain("## Footer");
  });
});
