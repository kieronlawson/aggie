import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { mapEntryToRawItem, parseFeedXml } from "#src/clients/feeds.ts";
import { Relationship, SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";

const FALLBACK_ISO = "2026-07-17T00:00:00.000Z";

const source: SourceRecord = {
  kind: SourceKind.Feed,
  url: "https://www.sec.gov/news/pressreleases.rss",
  name: "SEC press releases",
  vertical: Vertical.Finance,
  competitor: "",
  active: true,
  added_at: "2026-07-17T00:00:00Z"
};

const fixture = (name: string): string => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");

describe("parseFeedXml + mapEntryToRawItem", () => {
  it("maps RSS items with content:encoded, falling back through description", async () => {
    const entries = await parseFeedXml(fixture("feed-rss.xml"));
    expect(entries).toHaveLength(2);
    const items = entries.map((entry) => mapEntryToRawItem(entry, source, Relationship.Regulatory, FALLBACK_ISO));
    expect(items[0]?.url).toBe("https://www.sec.gov/news/press-release/2026-100");
    expect(items[0]?.title).toBe("SEC Charges Broker-Dealer With Recordkeeping Failures");
    expect(items[0]?.content).toContain("widespread recordkeeping failures");
    expect(items[0]?.published_at).toBe("2026-07-15T14:00:00.000Z");
    expect(items[0]?.vertical).toBe(Vertical.Finance);
    expect(items[0]?.relationship).toBe(Relationship.Regulatory);
  });

  it("uses the title as content and the fallback date when the entry has neither", async () => {
    const entries = await parseFeedXml(fixture("feed-rss.xml"));
    const bare = mapEntryToRawItem(entries[1] ?? {}, source, Relationship.Regulatory, FALLBACK_ISO);
    expect(bare.content).toBe("Item Without Content");
    expect(bare.published_at).toBe("2026-07-14T10:00:00.000Z");
  });

  it("maps Atom entries (EDGAR style)", async () => {
    const entries = await parseFeedXml(fixture("feed-atom.xml"));
    expect(entries).toHaveLength(1);
    const item = mapEntryToRawItem(entries[0] ?? {}, source, Relationship.Displace, FALLBACK_ISO);
    expect(item.url).toContain("sec.gov/Archives/edgar");
    expect(item.title).toBe("10-Q - Quarterly report");
    expect(item.content).toContain("Filed:");
  });

  it("drops entries without a link by returning an empty url", () => {
    const item = mapEntryToRawItem({}, source, Relationship.Regulatory, FALLBACK_ISO);
    expect(item.url).toBe("");
    expect(item.published_at).toBe(FALLBACK_ISO);
  });

  it("coerces object-valued fields (FINRA-style xml2js output) to strings safely", () => {
    const weird = {
      title: { _: "Actual Title", $: { type: "text" } } as unknown as string,
      link: { $: { href: "https://finra.org/x" } } as unknown as string,
      content: { _: "Body text" } as unknown as string
    };
    const item = mapEntryToRawItem(weird, source, Relationship.Regulatory, FALLBACK_ISO);
    expect(item.title).toBe("Actual Title");
    expect(item.content).toBe("Body text");
    expect(item.url).toBe("https://finra.org/x");
  });
});
