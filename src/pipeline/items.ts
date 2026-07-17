import { Classification, Relationship, Vertical, itemsNamespace } from "../config.js";
import { queryRows, upsertRows, type TpufRow } from "../clients/turbopuffer.js";
import { num, str, strList } from "../lib/coerce.js";
import type { StoredItem } from "./types.js";

const SEEN_BATCH = 100;

export const rowToItem = (row: TpufRow): StoredItem => ({
  id: row.id,
  url: str(row, "url"),
  source: str(row, "source"),
  vertical: str(row, "vertical") as Vertical,
  competitor: str(row, "competitor"),
  relationship: str(row, "relationship") as Relationship,
  classification: str(row, "classification") as Classification,
  sentiment: str(row, "sentiment"),
  published_at: num(row, "published_at"),
  title: str(row, "title"),
  summary: str(row, "summary"),
  merged_urls: strList(row, "merged_urls"),
  content_hash: str(row, "content_hash"),
  story_id: str(row, "story_id")
});

export const itemToRow = (item: StoredItem, vector?: number[]): TpufRow => ({
  ...(vector === undefined ? {} : { vector }),
  id: item.id,
  url: item.url,
  source: item.source,
  vertical: item.vertical,
  competitor: item.competitor,
  relationship: item.relationship,
  classification: item.classification,
  sentiment: item.sentiment,
  published_at: item.published_at,
  title: item.title,
  summary: item.summary,
  merged_urls: item.merged_urls,
  content_hash: item.content_hash,
  story_id: item.story_id
});

export const upsertItem = async (vertical: Vertical, item: StoredItem, vector?: number[]): Promise<void> =>
  upsertRows(itemsNamespace(vertical), [itemToRow(item, vector)]);

export const findByHash = async (vertical: Vertical, contentHash: string): Promise<StoredItem | undefined> => {
  const rows = await queryRows(itemsNamespace(vertical), {
    rank_by: ["id", "asc"],
    top_k: 1,
    filters: ["content_hash", "Eq", contentHash],
    include_attributes: true
  });
  const [row] = rows;
  return row === undefined ? undefined : rowToItem(row);
};

const seenBatch = async (vertical: Vertical, urls: readonly string[]): Promise<string[]> => {
  const rows = await queryRows(itemsNamespace(vertical), {
    rank_by: ["id", "asc"],
    top_k: urls.length,
    filters: ["Or", [["url", "In", [...urls]], ["merged_urls", "ContainsAny", [...urls]]]],
    include_attributes: ["url", "merged_urls"]
  });
  return rows.flatMap((row) => [String(row.url ?? ""), ...((row.merged_urls as string[] | undefined) ?? [])]);
};

export const seenUrls = async (vertical: Vertical, urls: readonly string[]): Promise<Set<string>> => {
  if (urls.length === 0) {
    return new Set();
  }
  const batches = Array.from({ length: Math.ceil(urls.length / SEEN_BATCH) }, (_, index) =>
    urls.slice(index * SEEN_BATCH, (index + 1) * SEEN_BATCH)
  );
  const results = await batches.reduce<Promise<string[]>>(async (accPromise, batch) => {
    const acc = await accPromise;
    const seen = await seenBatch(vertical, batch);
    return [...acc, ...seen];
  }, Promise.resolve([]));
  return new Set(results);
};

export type Neighbor = { item: StoredItem; similarity: number };

const NEIGHBOR_COUNT = 5;

export const nearestNeighbors = async (vertical: Vertical, vector: number[]): Promise<Neighbor[]> => {
  const rows = await queryRows(itemsNamespace(vertical), {
    rank_by: ["vector", "ANN", vector],
    top_k: NEIGHBOR_COUNT,
    include_attributes: true
  });
  return rows.map((row) => ({
    item: rowToItem(row),
    similarity: 1 - Number(row.$dist ?? 1)
  }));
};

export const itemsSince = async (vertical: Vertical, sinceSeconds: number): Promise<TpufRow[]> =>
  queryRows(itemsNamespace(vertical), {
    rank_by: ["id", "asc"],
    top_k: 1200,
    filters: ["published_at", "Gte", sinceSeconds],
    include_attributes: true
  });
