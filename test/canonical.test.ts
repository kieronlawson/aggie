import { describe, expect, it } from "vitest";
import { hostOf, isSyndicator, pickCanonical } from "../src/pipeline/canonical.js";

describe("isSyndicator", () => {
  it("flags known wire services and news aggregators", () => {
    expect(isSyndicator("https://www.businesswire.com/news/x")).toBe(true);
    expect(isSyndicator("https://finance.yahoo.com/news/x")).toBe(true);
    expect(isSyndicator("https://news.google.com/rss/articles/x")).toBe(true);
  });

  it("does not flag company newsrooms or regulators", () => {
    expect(isSyndicator("https://ir.ringcentral.com/news/x")).toBe(false);
    expect(isSyndicator("https://www.sec.gov/newsroom/press-releases/x")).toBe(false);
  });
});

describe("hostOf", () => {
  it("strips www and tolerates bad input", () => {
    expect(hostOf("https://www.sec.gov/x")).toBe("sec.gov");
    expect(hostOf("not a url")).toBe("");
  });
});

describe("pickCanonical", () => {
  it("prefers the originating domain over a syndicator", () => {
    const origin = { url: "https://ir.ringcentral.com/news/x", publishedAt: 200 };
    const wire = { url: "https://www.businesswire.com/x", publishedAt: 100 };
    expect(pickCanonical(wire, origin).url).toBe(origin.url);
    expect(pickCanonical(origin, wire).url).toBe(origin.url);
  });

  it("falls back to earliest published_at when both are the same class", () => {
    const earlier = { url: "https://ir.ringcentral.com/a", publishedAt: 100 };
    const later = { url: "https://www.8x8.com/b", publishedAt: 200 };
    expect(pickCanonical(later, earlier).url).toBe(earlier.url);
  });
});
