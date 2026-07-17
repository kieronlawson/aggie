import { createHash } from "node:crypto";

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " "
};

const decodeEntities = (text: string): string => {
  const named = text.replace(/&[a-z]+;/gu, (entity) => ENTITY_MAP[entity] ?? entity);
  return named.replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)));
};

/**
 * Normalizes markdown/HTML content for layer-1 dedupe hashing: strips tags,
 * decodes entities, lowercases, and collapses all whitespace, so verbatim
 * reprints hash identically regardless of markup and spacing differences.
 */
const normalizeContent = (content: string): string =>
  decodeEntities(content.replace(/<[^>]*>/gu, " "))
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();

const contentHash = (normalized: string): string => createHash("sha256").update(normalized).digest("hex");

export { contentHash, normalizeContent };
