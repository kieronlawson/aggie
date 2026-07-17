import { embedText } from "../clients/voyage.js";
import { maybePostAlert } from "./alerts.js";
import { classifyItem } from "./classify.js";
import { decideDedupe, mergeIntoExisting } from "./dedupe.js";
import { findByHash, upsertItem } from "./items.js";
import { itemIdFromHash, sha256Hex } from "./hash.js";
import { normalizeForHash } from "./normalize.js";
import type { ClassifiedFields, RawItem, StoredItem } from "./types.js";

export enum ProcessOutcome {
  MergedByHash = "merged_by_hash",
  MergedByCompare = "merged_by_compare",
  StoredSameStory = "stored_same_story",
  Stored = "stored"
}

const buildStoredItem = (
  raw: RawItem,
  fields: ClassifiedFields,
  contentHash: string,
  storyId: string
): StoredItem => ({
  id: itemIdFromHash(contentHash),
  url: raw.url,
  source: raw.sourceId,
  vertical: raw.vertical,
  competitor: raw.competitor,
  relationship: raw.relationship,
  classification: fields.classification,
  sentiment: fields.sentiment ?? "",
  published_at: raw.publishedAt,
  title: fields.title === "" ? raw.title : fields.title,
  summary: fields.summary,
  merged_urls: [],
  content_hash: contentHash,
  story_id: storyId
});

// The P pipeline from spec §P: normalize -> hash (layer 1) -> classify ->
// embed -> neighbour compare (layer 2) -> upsert, with canonical-URL merge
// (layer 3) on any duplicate and the immediate alert branch at the end.
export const processRawItem = async (raw: RawItem): Promise<ProcessOutcome> => {
  const hashInput = raw.diff === "" ? raw.content : raw.content + raw.diff;
  const contentHash = sha256Hex(normalizeForHash(hashInput));

  const hashMatch = await findByHash(raw.vertical, contentHash);
  if (hashMatch !== undefined) {
    await mergeIntoExisting(raw.vertical, hashMatch, { url: raw.url, publishedAt: raw.publishedAt });
    return ProcessOutcome.MergedByHash;
  }

  const fields = await classifyItem(raw);
  const vector = await embedText(`${fields.title}\n${fields.summary}`);
  const decision = await decideDedupe(raw.vertical, fields, vector);

  if (decision.kind === "merge") {
    await mergeIntoExisting(raw.vertical, decision.neighbor, { url: raw.url, publishedAt: raw.publishedAt });
    return ProcessOutcome.MergedByCompare;
  }

  const storyId = decision.kind === "same_story" ? decision.storyId : "";
  const item = buildStoredItem(raw, fields, contentHash, storyId);
  await upsertItem(raw.vertical, item, vector);
  await maybePostAlert(item);
  return decision.kind === "same_story" ? ProcessOutcome.StoredSameStory : ProcessOutcome.Stored;
};
