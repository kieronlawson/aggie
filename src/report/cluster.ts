import type { StoredItem } from "../pipeline/types.js";

export type Cluster = { key: string; items: StoredItem[] };

const CLUSTER_SIMILARITY_THRESHOLD = 0.83;

export const cosineSimilarity = (a: readonly number[], b: readonly number[]): number => {
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  return normA === 0 || normB === 0 ? 0 : dot / (normA * normB);
};

export const storyKey = (item: StoredItem): string => (item.story_id === "" ? item.id : item.story_id);

// Story-id grouping first (spec W3), then greedy embedding-similarity
// clustering for the groups that are still singletons.
export const groupByStory = (items: readonly StoredItem[]): Cluster[] => {
  const grouped = items.reduce<Map<string, StoredItem[]>>((map, item) => {
    const key = storyKey(item);
    return map.set(key, [...(map.get(key) ?? []), item]);
  }, new Map());
  return [...grouped.entries()].map(([key, groupItems]) => ({ key, items: groupItems }));
};

type VectorLookup = (item: StoredItem) => readonly number[];

const mergeStep = (clusters: Cluster[], cluster: Cluster, vectorOf: VectorLookup): Cluster[] => {
  const anchorOf = (candidate: Cluster): readonly number[] => vectorOf(candidate.items[0] as StoredItem);
  const matchIndex = clusters.findIndex(
    (existing) =>
      existing.items.length === 1 &&
      cluster.items.length === 1 &&
      cosineSimilarity(anchorOf(existing), anchorOf(cluster)) >= CLUSTER_SIMILARITY_THRESHOLD
  );
  if (matchIndex === -1) {
    return [...clusters, cluster];
  }
  const matched = clusters[matchIndex] as Cluster;
  const merged: Cluster = { key: matched.key, items: [...matched.items, ...cluster.items] };
  return [...clusters.slice(0, matchIndex), merged, ...clusters.slice(matchIndex + 1)];
};

export const clusterItems = (items: readonly StoredItem[], vectorOf: VectorLookup): Cluster[] => {
  const storyClusters = groupByStory(items);
  return storyClusters.reduce<Cluster[]>((clusters, cluster) => mergeStep(clusters, cluster, vectorOf), []);
};
