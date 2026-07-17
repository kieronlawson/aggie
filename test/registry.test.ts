import { describe, expect, it } from "vitest";
import { Relationship, SourceKind } from "../src/config.js";
import { competitorNameExists, newCompetitor, sourceId } from "../src/registry/store.js";
import { seedCompetitors, seedSources } from "../src/registry/seed.js";

describe("competitorNameExists", () => {
  const competitors = [newCompetitor("RingCentral", Relationship.Displace, ["RNG", "RingEX"])];

  it("matches on name case-insensitively", () => {
    expect(competitorNameExists(competitors, "ringcentral")).toBe(true);
  });

  it("matches on aliases", () => {
    expect(competitorNameExists(competitors, "RNG")).toBe(true);
  });

  it("rejects unknown names so a typo cannot create a new competitor", () => {
    expect(competitorNameExists(competitors, "RingCentrl")).toBe(false);
  });
});

describe("sourceId", () => {
  it("is deterministic per URL", () => {
    expect(sourceId("https://x.com/a")).toBe(sourceId("https://x.com/a"));
    expect(sourceId("https://x.com/a")).not.toBe(sourceId("https://x.com/b"));
  });
});

describe("seed data integrity", () => {
  it("every source competitor is a known competitor name", () => {
    const names = new Set(seedCompetitors().map((competitor) => competitor.name));
    const sources = seedSources();
    const orphans = sources.filter((source) => source.competitor !== "" && !names.has(source.competitor));
    expect(orphans).toEqual([]);
  });

  it("seeds feeds, job boards and crawl sources", () => {
    const kinds = new Set<string>(seedSources().map((source) => source.kind));
    expect(kinds.has(SourceKind.Feed)).toBe(true);
    expect(kinds.has(SourceKind.JobBoard)).toBe(true);
    expect(kinds.has(SourceKind.Crawl)).toBe(true);
  });
});
