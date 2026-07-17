import { describe, expect, it } from "vitest";

import { competitorId, competitorToRow, dummyVector, sourceId, sourceToRow, validateRegistry } from "#src/registry/records.ts";
import { type CompetitorRecord, Relationship, SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";

const competitor = (overrides: Partial<CompetitorRecord> = {}): CompetitorRecord => ({
  name: "RingCentral",
  relationship: Relationship.Displace,
  aliases: ["RNG"],
  active: true,
  ...overrides
});

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

describe("ids", () => {
  it("derives a stable source id from the URL", () => {
    expect(sourceId("https://example.com/feed.xml")).toBe(sourceId("https://example.com/feed.xml"));
    expect(sourceId("https://example.com/a")).not.toBe(sourceId("https://example.com/b"));
    expect(sourceId("https://example.com/feed.xml")).toMatch(/^source:[0-9a-f]{16}$/);
  });

  it("derives competitor ids from slugified names", () => {
    expect(competitorId("RingCentral")).toBe("competitor:ringcentral");
    expect(competitorId("Twilio Flex")).toBe("competitor:twilio-flex");
    expect(competitorId("8x8")).toBe("competitor:8x8");
  });
});

describe("row conversion", () => {
  it("produces a dummy vector of the registry dimension", () => {
    const vector = dummyVector();
    expect(vector).toHaveLength(1024);
    expect(vector[0]).toBe(1);
    expect(vector.slice(1).every((component) => component === 0)).toBe(true);
  });

  it("converts competitor records to rows with record_type", () => {
    const row = competitorToRow(competitor());
    expect(row.id).toBe("competitor:ringcentral");
    expect(row["record_type"]).toBe("competitor");
    expect(row["relationship"]).toBe("displace");
    expect(row["aliases"]).toEqual(["RNG"]);
  });

  it("converts source records to rows keyed by URL hash", () => {
    const record = source({ competitor: "RingCentral" });
    const row = sourceToRow(record);
    expect(row.id).toBe(sourceId(record.url));
    expect(row["record_type"]).toBe("source");
    expect(row["kind"]).toBe("feed");
    expect(row["competitor"]).toBe("RingCentral");
  });
});

describe("validateRegistry", () => {
  it("accepts a valid registry, including regulatory sources with no competitor", () => {
    const errors = validateRegistry([competitor()], [source(), source({ url: "https://example.com/b", competitor: "RingCentral" })]);
    expect(errors).toEqual([]);
  });

  it("rejects sources that reference an unknown competitor", () => {
    const errors = validateRegistry([competitor()], [source({ competitor: "RingCentrall" })]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("unknown competitor");
  });

  it("rejects duplicate competitor names", () => {
    const errors = validateRegistry([competitor(), competitor()], []);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Duplicate competitor name");
  });

  it("rejects duplicate source URLs", () => {
    const errors = validateRegistry([], [source(), source()]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Duplicate source URL");
  });

  it("rejects invalid URLs", () => {
    const errors = validateRegistry([], [source({ url: "not a url" })]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid URL");
  });
});
