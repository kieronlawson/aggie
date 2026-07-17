import { createHash } from "node:crypto";

import * as R from "ramda";

import { createAnthropic, HAIKU_MODEL, TEXT_BLOCK_TYPE } from "#src/clients/anthropic.ts";
import {
  patchRows,
  queryNearest,
  queryRows,
  TpufNamespace,
  type TpufResultRow,
  upsertRows
} from "#src/clients/turbopuffer.ts";
import { embed } from "#src/clients/voyage.ts";
import { type CanonicalCandidate, selectCanonical } from "#src/pipeline/canonical.ts";
import { classifyItem } from "#src/pipeline/classify.ts";
import { contentHash, normalizeContent } from "#src/pipeline/normalize.ts";
import { type ClassifyResult, DedupeVerdict, type RawItem } from "#src/pipeline/types.ts";
import { parseVerdict } from "#src/pipeline/verdict.ts";
import { Vertical } from "#src/registry/types.ts";

/**
 * Layer-2 dedupe candidate threshold (cosine similarity). Changes must be
 * logged in docs/tuning-log.md with date and reason.
 */
const DEDUPE_SIMILARITY_THRESHOLD = 0.9;

const ARBITRATE_MAX_TOKENS = 64;
const ITEM_ID_HASH_LENGTH = 16;

/** Regulator and competitor-newsroom domains outrank syndicators on merge. */
const ORIGINATING_DOMAINS = [
  "sec.gov",
  "finra.org",
  "cftc.gov",
  "fincen.gov",
  "ringcentral.com",
  "8x8.com",
  "aircall.io",
  "ujet.cx",
  "twilio.com",
  "thetalake.com",
  "smarsh.com"
];

enum ProcessOutcome {
  Stored = "stored",
  Merged = "merged"
}

const ITEMS_NAMESPACE_BY_VERTICAL: Record<Vertical, TpufNamespace> = {
  [Vertical.Finance]: TpufNamespace.ItemsFinance,
  [Vertical.Insurance]: TpufNamespace.ItemsInsurance,
  [Vertical.Healthcare]: TpufNamespace.ItemsHealthcare,
  [Vertical.Competitor]: TpufNamespace.ItemsCompetitor
};

const itemsNamespaceFor = (vertical: Vertical): TpufNamespace => ITEMS_NAMESPACE_BY_VERTICAL[vertical];

const itemId = (url: string): string =>
  `item:${createHash("sha256").update(url).digest("hex").slice(0, ITEM_ID_HASH_LENGTH)}`;

const str = (row: TpufResultRow, key: string): string => {
  const value = row[key];
  return typeof value === "string" ? value : "";
};

const mergeIntoExisting = async (namespace: TpufNamespace, existing: TpufResultRow, item: RawItem): Promise<void> => {
  const existingMerged = Array.isArray(existing["merged_urls"]) ? (existing["merged_urls"] as string[]) : [];
  const existingPublished = str(existing, "published_at");
  const candidates: CanonicalCandidate[] = R.uniqBy(R.prop("url"), [
    { url: str(existing, "url"), published_at: existingPublished },
    ...R.map((url: string) => ({ url, published_at: existingPublished }), existingMerged),
    { url: item.url, published_at: item.published_at }
  ]);
  const selection = selectCanonical(candidates, ORIGINATING_DOMAINS);
  await patchRows(namespace, [
    { id: existing.id, url: selection.canonicalUrl, merged_urls: selection.mergedUrls }
  ]);
};

const ARBITRATE_SCHEMA = {
  type: "object",
  properties: { verdict: { type: "string", enum: Object.values(DedupeVerdict) } },
  required: ["verdict"],
  additionalProperties: false
} as const;

const arbitrate = async (item: ClassifyResult, neighbour: TpufResultRow): Promise<DedupeVerdict> => {
  const prompt = [
    "Two intel items may cover the same underlying event. Compare them.",
    "- duplicate: same content (reprint/syndication of one announcement)",
    "- same_story: different articles about the same underlying event",
    "- distinct: different events",
    "",
    `Item A title: ${item.title}`,
    `Item A summary: ${item.summary}`,
    "",
    `Item B title: ${str(neighbour, "title")}`,
    `Item B summary: ${str(neighbour, "summary")}`
  ].join("\n");
  const response = await createAnthropic().messages.create({
    model: HAIKU_MODEL,
    max_tokens: ARBITRATE_MAX_TOKENS,
    output_config: { format: { type: "json_schema", schema: ARBITRATE_SCHEMA } },
    messages: [{ role: "user", content: prompt }]
  });
  const block = response.content[0];
  return block !== undefined && block.type === TEXT_BLOCK_TYPE ? parseVerdict(block.text) : DedupeVerdict.Distinct;
};

type StoreContext = {
  namespace: TpufNamespace;
  item: RawItem;
  classified: ClassifyResult;
  vector: number[];
  hash: string;
  storyId: string;
};

const storeItem = async (ctx: StoreContext): Promise<void> => {
  await upsertRows(ctx.namespace, [
    {
      id: itemId(ctx.item.url),
      vector: ctx.vector,
      url: ctx.item.url,
      source: ctx.item.source,
      vertical: ctx.item.vertical,
      competitor: ctx.item.competitor,
      relationship: ctx.item.relationship,
      classification: ctx.classified.classification,
      sentiment: ctx.classified.sentiment,
      published_at: ctx.item.published_at,
      published_at_ms: Date.parse(ctx.item.published_at),
      title: ctx.classified.title.length > 0 ? ctx.classified.title : ctx.item.title,
      summary: ctx.classified.summary,
      entities: ctx.classified.entities,
      relevant: ctx.classified.relevant,
      merged_urls: [],
      content_hash: ctx.hash,
      story_id: ctx.storyId
    }
  ]);
};

const layer2StoryId = async (
  classified: ClassifyResult,
  nearest: TpufResultRow | undefined
): Promise<string | null> => {
  const similarity = nearest?.$dist === undefined ? 0 : 1 - nearest.$dist;
  if (nearest === undefined || similarity < DEDUPE_SIMILARITY_THRESHOLD) {
    return "";
  }
  const verdict = await arbitrate(classified, nearest);
  if (verdict === DedupeVerdict.Duplicate) {
    return null;
  }
  if (verdict === DedupeVerdict.SameStory) {
    const neighbourStory = str(nearest, "story_id");
    return neighbourStory.length > 0 ? neighbourStory : String(nearest.id);
  }
  return "";
};

/**
 * The P pipeline for one item: normalize → hash → layer-1 exact dedupe →
 * classify → embed → layer-2 neighbour arbitration → layer-3 canonical merge
 * or upsert. Assumes the caller already filtered seen URLs.
 */
const processRawItem = async (item: RawItem): Promise<ProcessOutcome> => {
  const namespace = itemsNamespaceFor(item.vertical);
  const hash = contentHash(normalizeContent(`${item.title}\n${item.content}`));
  const hashMatches = await queryRows({
    namespace,
    filters: ["content_hash", "Eq", hash],
    topK: 1
  });
  const exact = hashMatches[0];
  if (exact !== undefined) {
    await mergeIntoExisting(namespace, exact, item);
    return ProcessOutcome.Merged;
  }
  const classified = await classifyItem(item);
  const vectors = await embed([`${classified.title}\n${classified.summary}`], "document");
  const vector = vectors[0];
  if (vector === undefined) {
    throw new Error(`Voyage returned no embedding for ${item.url}`);
  }
  const neighbours = await queryNearest({ namespace, vector, topK: 1 });
  const storyId = await layer2StoryId(classified, neighbours[0]);
  if (storyId === null) {
    const nearest = neighbours[0];
    if (nearest !== undefined) {
      await mergeIntoExisting(namespace, nearest, item);
    }
    return ProcessOutcome.Merged;
  }
  await storeItem({ namespace, item, classified, vector, hash, storyId });
  return ProcessOutcome.Stored;
};

export { DEDUPE_SIMILARITY_THRESHOLD, itemId, itemsNamespaceFor, ORIGINATING_DOMAINS, ProcessOutcome, processRawItem };
