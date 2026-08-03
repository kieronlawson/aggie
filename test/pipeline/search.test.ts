import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SearchDrop, searchPublishedAt, searchRawItem } from "#src/pipeline/search.ts";
import { SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";

const dropFixtures = JSON.parse(
  readFileSync(new URL("../fixtures/search-drop-urls.json", import.meta.url), "utf8")
) as { url: string; expected: string }[];

const NOW_MS = Date.parse("2026-07-29T12:00:00.000Z");

const source: SourceRecord = {
  kind: SourceKind.Search,
  url: "insurance telemarketing TCPA enforcement",
  name: "Search: insurance TCPA/telemarketing",
  vertical: Vertical.Insurance,
  competitor: "",
  active: true,
  added_at: "2026-07-29T00:00:00Z"
};

describe("searchPublishedAt", () => {
  it("passes through parseable dates as ISO", () => {
    expect(searchPublishedAt("2026-07-27T08:30:00Z", NOW_MS)).toBe("2026-07-27T08:30:00.000Z");
    expect(searchPublishedAt("Jul 27, 2026", NOW_MS)).toMatch(/^2026-07-2[67]T/);
  });

  it("resolves relative dates against now", () => {
    expect(searchPublishedAt("3 days ago", NOW_MS)).toBe("2026-07-26T12:00:00.000Z");
    expect(searchPublishedAt("5 hours ago", NOW_MS)).toBe("2026-07-29T07:00:00.000Z");
    expect(searchPublishedAt("1 week ago", NOW_MS)).toBe("2026-07-22T12:00:00.000Z");
  });

  it("returns empty for garbage or missing dates", () => {
    expect(searchPublishedAt("", NOW_MS)).toBe("");
    expect(searchPublishedAt("recently", NOW_MS)).toBe("");
  });
});

describe("searchRawItem", () => {
  const result = {
    title: "State DOI fines agency over robocalls",
    url: "https://example.com/doi-fines-agency",
    snippet: "The agency used prerecorded calls without consent.",
    date: "2 days ago"
  };

  it("maps a dated result to a RawItem carrying the source name and vertical", () => {
    const item = searchRawItem({ source, result, nowMs: NOW_MS });
    expect(item).toMatchObject({
      url: "https://example.com/doi-fines-agency",
      title: "State DOI fines agency over robocalls",
      published_at: "2026-07-27T12:00:00.000Z",
      source: "Search: insurance TCPA/telemarketing",
      vertical: Vertical.Insurance
    });
    expect((item as { content: string }).content).toContain("prerecorded calls");
  });

  it("drops undated results instead of stamping them fresh", () => {
    const { date: _date, ...undated } = result;
    expect(searchRawItem({ source, result: undated, nowMs: NOW_MS })).toBe(SearchDrop.Undated);
  });

  it("drops results older than the ingest window", () => {
    const stale = { ...result, date: "2026-07-01T00:00:00Z" };
    expect(searchRawItem({ source, result: stale, nowMs: NOW_MS })).toBe(SearchDrop.Stale);
  });

  it("drops results without a usable URL", () => {
    const { url: _url, ...unlinked } = result;
    expect(searchRawItem({ source, result: unlinked, nowMs: NOW_MS })).toBe(SearchDrop.NoUrl);
  });

  it.each(dropFixtures)("classifies $url as $expected", ({ url, expected }) => {
    const mapped = searchRawItem({ source, result: { ...result, url }, nowMs: NOW_MS });
    const actual = typeof mapped === "string" ? mapped : "ok";
    expect(actual).toBe(expected);
  });
});
