import { describe, expect, it } from "vitest";

import { layer2StoryId } from "#src/pipeline/process.ts";
import { Classification, ContentKind, type RawItem } from "#src/pipeline/types.ts";
import { Relationship, Vertical } from "#src/registry/types.ts";

const ITEM: RawItem = {
  url: "https://www.ringcentral.com/office/plansandpricing.html",
  title: "RingCentral pricing — page updated",
  content: "diff",
  published_at: "2026-07-20T00:00:00Z",
  source: "RingCentral pricing",
  vertical: Vertical.Competitor,
  competitor: "RingCentral",
  relationship: Relationship.Displace
};

const CLASSIFIED = {
  classification: Classification.Other,
  sentiment: "" as const,
  title: "RingCentral pricing updated",
  summary: "Pricing changed.",
  entities: [],
  relevant: true,
  content_kind: ContentKind.News
};

describe("layer2StoryId self-page continuity", () => {
  it("returns the previous version's story id without arbitration when the neighbour is the same URL", async () => {
    const nearest = { id: "item:abc", $dist: 0.02, url: ITEM.url, story_id: "story:1" };
    await expect(layer2StoryId(ITEM, CLASSIFIED, nearest)).resolves.toBe("story:1");
  });

  it("falls back to the neighbour id when it has no story id", async () => {
    const nearest = { id: "item:abc", $dist: 0.02, url: ITEM.url, story_id: "" };
    await expect(layer2StoryId(ITEM, CLASSIFIED, nearest)).resolves.toBe("item:abc");
  });

  it("still stores fresh when there is no neighbour above threshold", async () => {
    await expect(layer2StoryId(ITEM, CLASSIFIED, undefined)).resolves.toBe("");
  });
});
