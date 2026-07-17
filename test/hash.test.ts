import { describe, expect, it } from "vitest";
import { itemIdFromHash, sha256Hex } from "../src/pipeline/hash.js";
import { normalizeForHash } from "../src/pipeline/normalize.js";
import { PRESS_RELEASE_INSIDE_ARTICLE, SYNDICATED_PAIRS } from "./fixtures/syndicated-pairs.js";

const hashOf = (html: string): string => sha256Hex(normalizeForHash(html));

describe("content hashing on syndicated pairs", () => {
  it.each(SYNDICATED_PAIRS)("matches origin and syndicated copy for $name", (pair) => {
    expect(hashOf(pair.originHtml)).toBe(hashOf(pair.syndicatedHtml));
  });
});

describe("press release inside article", () => {
  it("does NOT hash-match the article (reporter framing differs)", () => {
    expect(hashOf(PRESS_RELEASE_INSIDE_ARTICLE.pressReleaseHtml)).not.toBe(
      hashOf(PRESS_RELEASE_INSIDE_ARTICLE.articleHtml)
    );
  });
});

describe("itemIdFromHash", () => {
  it("derives a stable id prefix from the hash", () => {
    const hash = sha256Hex("abc");
    expect(itemIdFromHash(hash)).toBe(itemIdFromHash(hash));
    expect(itemIdFromHash(hash).startsWith("item-")).toBe(true);
  });
});
