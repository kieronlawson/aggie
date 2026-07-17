import { describe, expect, it } from "vitest";

import { renderSourcesMarkdown } from "#src/registry/export.ts";
import { type CompetitorRecord, Relationship, SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";

const competitors: CompetitorRecord[] = [
  { name: "RingCentral", relationship: Relationship.Displace, aliases: ["RNG"], active: true },
  { name: "Theta Lake", relationship: Relationship.Partner, aliases: [], active: true }
];

const sources: SourceRecord[] = [
  {
    kind: SourceKind.Feed,
    url: "https://www.sec.gov/news/pressreleases.rss",
    name: "SEC press releases",
    vertical: Vertical.Finance,
    competitor: "",
    active: true,
    added_at: "2026-07-17T00:00:00Z"
  },
  {
    kind: SourceKind.JobBoard,
    url: "https://boards-api.greenhouse.io/v1/boards/ringcentral/jobs",
    name: "RingCentral jobs",
    vertical: Vertical.Competitor,
    competitor: "RingCentral",
    active: true,
    added_at: "2026-07-17T00:00:00Z"
  }
];

describe("renderSourcesMarkdown", () => {
  it("renders competitors and per-vertical sections, skipping empty verticals", () => {
    const markdown = renderSourcesMarkdown(competitors, sources, ["SEC needs a declared-contact User-Agent."]);
    expect(markdown).toContain("| RingCentral (aliases: RNG) | displace |");
    expect(markdown).toContain("| Theta Lake | partner |");
    expect(markdown).toContain("## Vertical: finance");
    expect(markdown).toContain("## Vertical: competitor");
    expect(markdown).not.toContain("## Vertical: insurance");
    expect(markdown).toContain("| SEC press releases | feed | — | https://www.sec.gov/news/pressreleases.rss |");
    expect(markdown).toContain("| RingCentral jobs | job_board | RingCentral |");
    expect(markdown).toContain("## Notes and caveats");
    expect(markdown).toContain("- SEC needs a declared-contact User-Agent.");
  });
});
