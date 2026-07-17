import { structuredJson } from "../clients/anthropic.js";
import { CLASSIFY_MODEL, Vertical, dedupeCandidateThreshold } from "../config.js";
import { pickCanonical } from "./canonical.js";
import { nearestNeighbors, upsertItem, type Neighbor } from "./items.js";
import type { ClassifiedFields, RawItem, StoredItem } from "./types.js";

export enum CompareVerdict {
  Duplicate = "duplicate",
  SameStory = "same_story",
  Distinct = "distinct"
}

const COMPARE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: Object.values(CompareVerdict) }
  },
  required: ["verdict"],
  additionalProperties: false
};

const COMPARE_SYSTEM = [
  "You compare two intelligence items and decide their relationship.",
  "duplicate: the same article or announcement (reprints, syndicated copies, press release",
  "reproduced inside an article count as duplicate).",
  "same_story: different articles covering the same underlying event.",
  "distinct: different events."
].join(" ");

const COMPARE_SNIPPET_CHARS = 1500;

export const parseVerdict = (raw: unknown): CompareVerdict => {
  const verdict = (raw as { verdict?: string }).verdict;
  return Object.values(CompareVerdict).includes(verdict as CompareVerdict)
    ? (verdict as CompareVerdict)
    : CompareVerdict.Distinct;
};

export const compareItems = async (
  candidate: { title: string; summary: string },
  neighbor: { title: string; summary: string }
): Promise<CompareVerdict> => {
  const user = [
    "ITEM A:",
    `Title: ${candidate.title}`,
    `Summary: ${candidate.summary.slice(0, COMPARE_SNIPPET_CHARS)}`,
    "",
    "ITEM B:",
    `Title: ${neighbor.title}`,
    `Summary: ${neighbor.summary.slice(0, COMPARE_SNIPPET_CHARS)}`
  ].join("\n");
  const raw = await structuredJson({
    model: CLASSIFY_MODEL,
    system: COMPARE_SYSTEM,
    user,
    schema: COMPARE_SCHEMA
  });
  return parseVerdict(raw);
};

// Layer-3 merge: fold the new copy's URL into the existing item, keeping the
// canonical URL per pickCanonical and the earliest published_at.
export const mergeCopy = (existing: StoredItem, copy: { url: string; publishedAt: number }): StoredItem => {
  const alreadyKnown = existing.url === copy.url || existing.merged_urls.includes(copy.url);
  if (alreadyKnown) {
    return existing;
  }
  const winner = pickCanonical(
    { url: existing.url, publishedAt: existing.published_at },
    { url: copy.url, publishedAt: copy.publishedAt }
  );
  const canonicalUrl = winner.url;
  const loserUrl = canonicalUrl === existing.url ? copy.url : existing.url;
  return {
    ...existing,
    url: canonicalUrl,
    published_at: Math.min(existing.published_at, copy.publishedAt),
    merged_urls: [...existing.merged_urls, loserUrl]
  };
};

export const mergeIntoExisting = async (
  vertical: Vertical,
  existing: StoredItem,
  copy: { url: string; publishedAt: number }
): Promise<StoredItem> => {
  const merged = mergeCopy(existing, copy);
  if (merged !== existing) {
    await upsertItem(vertical, merged);
  }
  return merged;
};

export type DedupeDecision =
  | { kind: "merge"; neighbor: StoredItem }
  | { kind: "same_story"; storyId: string }
  | { kind: "distinct" };

const bestCandidate = (neighbors: readonly Neighbor[]): Neighbor | undefined => {
  const threshold = dedupeCandidateThreshold();
  return neighbors.filter((neighbor) => neighbor.similarity >= threshold)[0];
};

// Layer 2: embedding neighbour above the candidate threshold triggers one
// Haiku comparison call; verdict decides merge / same_story / distinct.
export const decideDedupe = async (
  vertical: Vertical,
  fields: ClassifiedFields,
  vector: number[]
): Promise<DedupeDecision> => {
  const neighbors = await nearestNeighbors(vertical, vector);
  const candidate = bestCandidate(neighbors);
  if (candidate === undefined) {
    return { kind: "distinct" };
  }
  const verdict = await compareItems(fields, candidate.item);
  if (verdict === CompareVerdict.Duplicate) {
    return { kind: "merge", neighbor: candidate.item };
  }
  if (verdict === CompareVerdict.SameStory) {
    const storyId = candidate.item.story_id === "" ? candidate.item.id : candidate.item.story_id;
    return { kind: "same_story", storyId };
  }
  return { kind: "distinct" };
};

export type { RawItem };
