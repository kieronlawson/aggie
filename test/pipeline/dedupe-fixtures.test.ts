import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { isOriginatingDomain, selectCanonical } from "#src/pipeline/canonical.ts";
import { contentHash, normalizeContent } from "#src/pipeline/normalize.ts";
import { ORIGINATING_DOMAINS } from "#src/pipeline/process.ts";

type FixtureDoc = {
  url: string;
  source_domain: string;
  title: string;
  published_at: string;
  content: string;
};

type Fixtures = {
  pair1: { original: FixtureDoc; syndicated: FixtureDoc; shared_paragraph: string };
  pair2: { original: FixtureDoc; syndicated: FixtureDoc; shared_quote: string };
  pair3: { original: FixtureDoc; syndicated: FixtureDoc };
  pressReleaseCase: { release: FixtureDoc; article: FixtureDoc; shared_quote: string };
};

const fixtures = JSON.parse(
  readFileSync(new URL("../fixtures/dedupe-pairs.json", import.meta.url), "utf8")
) as Fixtures;

describe("normalize + hash on real syndicated pairs", () => {
  it("hashes shared verbatim passages identically across outlets (pair 1, verbatim reprint)", () => {
    const { original, syndicated, shared_paragraph } = fixtures.pair1;
    expect(original.content).toContain(shared_paragraph);
    expect(syndicated.content).toContain(shared_paragraph);
    expect(contentHash(normalizeContent(shared_paragraph))).toBe(contentHash(normalizeContent(shared_paragraph)));
    const originalTail = normalizeContent(original.content).split("the securities and exchange commission")[1];
    const syndicatedTail = normalizeContent(syndicated.content).split("the securities and exchange commission")[1];
    expect(originalTail).toBe(syndicatedTail);
  });

  it("does not hash-match a genuine rewrite (pair 2) — that is layer 2's job", () => {
    const { original, syndicated, shared_quote } = fixtures.pair2;
    expect(normalizeContent(original.content)).toContain(normalizeContent(shared_quote));
    expect(normalizeContent(syndicated.content)).toContain(normalizeContent(shared_quote));
    expect(contentHash(normalizeContent(original.content))).not.toBe(contentHash(normalizeContent(syndicated.content)));
  });

  it("distinguishes the three enforcement waves — heavy boilerplate but distinct stories", () => {
    const hashes = [fixtures.pair1, fixtures.pair2, fixtures.pair3].map((pair) =>
      contentHash(normalizeContent(pair.original.content))
    );
    expect(new Set(hashes).size).toBe(3);
  });
});

describe("canonical selection on real pairs", () => {
  const candidates = (pair: {
    original: FixtureDoc;
    syndicated: FixtureDoc;
  }): { url: string; published_at: string }[] => [
    { url: pair.syndicated.url, published_at: pair.syndicated.published_at },
    { url: pair.original.url, published_at: pair.original.published_at }
  ];

  it("prefers sec.gov over syndicators for all three pairs", () => {
    const pairs = [fixtures.pair1, fixtures.pair2, fixtures.pair3];
    pairs.forEach((pair) => {
      expect(selectCanonical(candidates(pair), ORIGINATING_DOMAINS).canonicalUrl).toBe(pair.original.url);
    });
  });

  it("prefers the company newsroom over trade press for the press-release case", () => {
    const { release, article } = fixtures.pressReleaseCase;
    expect(isOriginatingDomain(release.url, ORIGINATING_DOMAINS)).toBe(true);
    expect(isOriginatingDomain(article.url, ORIGINATING_DOMAINS)).toBe(false);
    const selection = selectCanonical(
      [
        { url: article.url, published_at: article.published_at },
        { url: release.url, published_at: release.published_at }
      ],
      ORIGINATING_DOMAINS
    );
    expect(selection.canonicalUrl).toBe(release.url);
    expect(selection.mergedUrls).toEqual([article.url]);
  });

  it("press release and article share verbatim quotes but hash differently (article ≠ reprint)", () => {
    const { release, article, shared_quote } = fixtures.pressReleaseCase;
    expect(normalizeContent(release.content)).toContain(normalizeContent(shared_quote));
    expect(normalizeContent(article.content)).toContain(normalizeContent(shared_quote));
    expect(contentHash(normalizeContent(release.content))).not.toBe(contentHash(normalizeContent(article.content)));
  });
});
