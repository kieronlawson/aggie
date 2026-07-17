import * as R from "ramda";

/** Minimum centroid similarity for two items to share a report cluster. */
const CLUSTER_SIMILARITY_THRESHOLD = 0.85;

type ClusterableItem = {
  id: string;
  story_id: string;
  vector: number[];
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  const dot = R.sum(R.zipWith((x, y) => x * y, a, b));
  const magnitude = Math.sqrt(R.sum(R.map((x) => x * x, a))) * Math.sqrt(R.sum(R.map((y) => y * y, b)));
  return magnitude === 0 ? 0 : dot / magnitude;
};

const centroid = (vectors: number[][]): number[] => {
  const first = vectors[0];
  if (first === undefined) {
    return [];
  }
  const sums = R.reduce(
    (acc: number[], vector: number[]) => R.zipWith(R.add, acc, vector),
    R.map(() => 0, first),
    vectors
  );
  return R.map((sum) => sum / vectors.length, sums);
};

const storyKey = (item: ClusterableItem): string => (item.story_id.length > 0 ? item.story_id : item.id);

const assignBySimilarity = <T extends ClusterableItem>(clusters: T[][], group: T[]): T[][] => {
  const groupCentroid = centroid(R.map((item: T) => item.vector, group));
  const similarities = R.map(
    (cluster: T[]) => cosineSimilarity(groupCentroid, centroid(R.map((item: T) => item.vector, cluster))),
    clusters
  );
  const bestIndex = similarities.indexOf(Math.max(...similarities, -Infinity));
  const bestSimilarity = similarities[bestIndex] ?? -Infinity;
  if (bestSimilarity >= CLUSTER_SIMILARITY_THRESHOLD) {
    return R.adjust(bestIndex, (cluster) => [...cluster, ...group], clusters);
  }
  return [...clusters, group];
};

/**
 * Clusters items for the weekly report: items sharing a story_id (or whose
 * story_id points at another item's id) group first; the remaining groups are
 * merged greedily by embedding-centroid similarity.
 */
const clusterItems = <T extends ClusterableItem>(items: T[]): T[][] => {
  const storyGroups = Object.values(R.groupBy(storyKey, items)) as T[][];
  return R.reduce(assignBySimilarity<T>, [], storyGroups);
};

export { CLUSTER_SIMILARITY_THRESHOLD, type ClusterableItem, clusterItems, cosineSimilarity };
