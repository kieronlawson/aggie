import { describe, expect, it } from "vitest";

import { CLUSTER_SIMILARITY_THRESHOLD, clusterItems, cosineSimilarity } from "#src/report/cluster.ts";

type Item = { url: string; story_id: string; vector: number[] };

const item = (url: string, storyId: string, vector: number[]): Item => ({ url, story_id: storyId, vector });

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors and 0 for orthogonal ones", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("is 0 for zero vectors instead of NaN", () => {
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
  });
});

describe("clusterItems", () => {
  it("groups items sharing a story_id even when embeddings differ", () => {
    const root = item("https://a.com/1", "", [1, 0]);
    const follower = item("https://b.com/2", "item:a", [0, 1]);
    const clusters = clusterItems([{ ...root, id: "item:a" }, { ...follower, id: "item:b" }]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(2);
  });

  it("clusters remainder by embedding similarity above the threshold", () => {
    const a = { ...item("https://a.com/1", "", [1, 0]), id: "item:a" };
    const near = { ...item("https://b.com/2", "", [0.97, 0.24]), id: "item:b" };
    const far = { ...item("https://c.com/3", "", [0, 1]), id: "item:c" };
    const clusters = clusterItems([a, near, far]);
    expect(clusters).toHaveLength(2);
    const sizes = clusters.map((cluster) => cluster.length).sort();
    expect(sizes).toEqual([1, 2]);
  });

  it("returns empty for no items", () => {
    expect(clusterItems([])).toEqual([]);
  });

  it("exposes the threshold as a named constant", () => {
    expect(CLUSTER_SIMILARITY_THRESHOLD).toBeGreaterThan(0.5);
    expect(CLUSTER_SIMILARITY_THRESHOLD).toBeLessThan(1);
  });
});
