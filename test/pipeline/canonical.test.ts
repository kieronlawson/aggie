import { describe, expect, it } from "vitest";

import { isOriginatingDomain, selectCanonical } from "#src/pipeline/canonical.ts";

const ORIGINATING = ["sec.gov", "finra.org", "ringcentral.com"];

describe("isOriginatingDomain", () => {
  it("matches exact domains and subdomains", () => {
    expect(isOriginatingDomain("https://www.sec.gov/news/x", ORIGINATING)).toBe(true);
    expect(isOriginatingDomain("https://ir.ringcentral.com/press", ORIGINATING)).toBe(true);
    expect(isOriginatingDomain("https://www.jdsupra.com/legalnews/x", ORIGINATING)).toBe(false);
  });

  it("does not match lookalike domains", () => {
    expect(isOriginatingDomain("https://notsec.gov.example.com/x", ORIGINATING)).toBe(false);
    expect(isOriginatingDomain("https://fakeringcentral.com/x", ORIGINATING)).toBe(false);
  });
});

describe("selectCanonical", () => {
  const regulator = { url: "https://www.sec.gov/news/press-release/2026-1", published_at: "2026-07-10T12:00:00Z" };
  const syndicatorEarly = { url: "https://www.jdsupra.com/legalnews/sec-fines", published_at: "2026-07-09T00:00:00Z" };
  const syndicatorLate = { url: "https://www.natlawreview.com/article/sec-fines", published_at: "2026-07-11T00:00:00Z" };

  it("prefers the originating domain over syndicators regardless of date", () => {
    const result = selectCanonical([syndicatorEarly, regulator, syndicatorLate], ORIGINATING);
    expect(result.canonicalUrl).toBe(regulator.url);
    expect(result.mergedUrls).toEqual([syndicatorEarly.url, syndicatorLate.url]);
  });

  it("falls back to earliest published_at when no originating domain present", () => {
    const result = selectCanonical([syndicatorLate, syndicatorEarly], ORIGINATING);
    expect(result.canonicalUrl).toBe(syndicatorEarly.url);
    expect(result.mergedUrls).toEqual([syndicatorLate.url]);
  });

  it("handles a single candidate", () => {
    const result = selectCanonical([regulator], ORIGINATING);
    expect(result.canonicalUrl).toBe(regulator.url);
    expect(result.mergedUrls).toEqual([]);
  });

  it("treats unparseable published_at as latest, not earliest", () => {
    const broken = { url: "https://example.com/broken", published_at: "not-a-date" };
    const result = selectCanonical([broken, syndicatorEarly], ORIGINATING);
    expect(result.canonicalUrl).toBe(syndicatorEarly.url);
  });
});
