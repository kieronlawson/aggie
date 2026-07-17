import { describe, expect, it } from "vitest";
import { Classification, Relationship, Vertical } from "../src/config.js";
import { CompareVerdict, mergeCopy, parseVerdict } from "../src/pipeline/dedupe.js";
import type { StoredItem } from "../src/pipeline/types.js";

const baseItem = (over: Partial<StoredItem>): StoredItem => ({
  id: "item-1",
  url: "https://ir.ringcentral.com/a",
  source: "src-x",
  vertical: Vertical.Competitor,
  competitor: "RingCentral",
  relationship: Relationship.Displace,
  classification: Classification.ProductAnnouncement,
  sentiment: "",
  published_at: 200,
  title: "t",
  summary: "s",
  merged_urls: [],
  content_hash: "h",
  story_id: "",
  ...over
});

describe("parseVerdict", () => {
  it("parses valid verdicts and defaults unknowns to distinct", () => {
    expect(parseVerdict({ verdict: "duplicate" })).toBe(CompareVerdict.Duplicate);
    expect(parseVerdict({ verdict: "same_story" })).toBe(CompareVerdict.SameStory);
    expect(parseVerdict({ verdict: "garbage" })).toBe(CompareVerdict.Distinct);
    expect(parseVerdict({})).toBe(CompareVerdict.Distinct);
  });
});

describe("mergeCopy", () => {
  it("folds a syndicated copy in, keeping the newsroom URL canonical", () => {
    const existing = baseItem({ url: "https://ir.ringcentral.com/a", published_at: 200 });
    const merged = mergeCopy(existing, { url: "https://www.businesswire.com/x", publishedAt: 100 });
    expect(merged.url).toBe("https://ir.ringcentral.com/a");
    expect(merged.merged_urls).toContain("https://www.businesswire.com/x");
    expect(merged.published_at).toBe(100);
  });

  it("promotes the newsroom copy to canonical when the existing item is a syndicator", () => {
    const existing = baseItem({ url: "https://www.businesswire.com/x", published_at: 100 });
    const merged = mergeCopy(existing, { url: "https://ir.ringcentral.com/a", publishedAt: 200 });
    expect(merged.url).toBe("https://ir.ringcentral.com/a");
    expect(merged.merged_urls).toContain("https://www.businesswire.com/x");
  });

  it("is a no-op when the copy is already known", () => {
    const existing = baseItem({ url: "https://ir.ringcentral.com/a" });
    expect(mergeCopy(existing, { url: "https://ir.ringcentral.com/a", publishedAt: 50 })).toBe(existing);
  });
});
