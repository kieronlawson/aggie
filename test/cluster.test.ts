import { describe, expect, it } from "vitest";
import { Classification, Relationship, Vertical } from "../src/config.js";
import { clusterItems, cosineSimilarity, groupByStory, storyKey } from "../src/report/cluster.js";
import type { StoredItem } from "../src/pipeline/types.js";

const item = (id: string, storyId: string): StoredItem => ({
  id,
  url: `https://x/${id}`,
  source: "s",
  vertical: Vertical.Finance,
  competitor: "",
  relationship: Relationship.Regulatory,
  classification: Classification.EnforcementAction,
  sentiment: "",
  published_at: 1,
  title: id,
  summary: id,
  merged_urls: [],
  content_hash: id,
  story_id: storyId
});

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors and 0 for orthogonal ones", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe("storyKey / groupByStory", () => {
  it("uses story_id when present, else id", () => {
    expect(storyKey(item("a", "story-1"))).toBe("story-1");
    expect(storyKey(item("b", ""))).toBe("b");
  });

  it("groups items sharing a story_id", () => {
    const groups = groupByStory([item("a", "story-1"), item("b", "story-1"), item("c", "")]);
    const storyGroup = groups.find((group) => group.key === "story-1");
    expect(storyGroup?.items).toHaveLength(2);
    expect(groups).toHaveLength(2);
  });
});

describe("clusterItems", () => {
  it("merges singletons whose vectors are similar", () => {
    const vectors: Record<string, number[]> = {
      a: [1, 0, 0],
      b: [0.99, 0.01, 0],
      c: [0, 0, 1]
    };
    const clusters = clusterItems([item("a", ""), item("b", ""), item("c", "")], (i) => vectors[i.id] ?? []);
    const sizes = clusters.map((cluster) => cluster.items.length).sort();
    expect(sizes).toEqual([1, 2]);
  });

  it("keeps story clusters intact and does not merge distinct vectors", () => {
    const vectors: Record<string, number[]> = { a: [1, 0], b: [0, 1] };
    const clusters = clusterItems([item("a", ""), item("b", "")], (i) => vectors[i.id] ?? []);
    expect(clusters).toHaveLength(2);
  });
});
