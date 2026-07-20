import { describe, expect, it } from "vitest";

import { parseClassifyResult, SYSTEM_PROMPT } from "#src/pipeline/classify.ts";
import { Classification, ContentKind, Sentiment } from "#src/pipeline/types.ts";

describe("parseClassifyResult", () => {
  it("parses a valid structured response", () => {
    const result = parseClassifyResult(
      JSON.stringify({
        classification: "enforcement_action",
        sentiment: "",
        title: "SEC fines broker-dealer",
        summary: "The SEC fined a firm for recordkeeping failures.",
        entities: ["SEC"],
        relevant: true
      })
    );
    expect(result.classification).toBe(Classification.EnforcementAction);
    expect(result.sentiment).toBe("");
    expect(result.entities).toEqual(["SEC"]);
    expect(result.relevant).toBe(true);
  });

  it("parses an off-topic verdict", () => {
    const result = parseClassifyResult(
      JSON.stringify({
        classification: "commentary",
        sentiment: "",
        title: "New Jersey data broker rule update",
        summary: "Registration deferred until the public registry launches.",
        entities: [],
        relevant: false
      })
    );
    expect(result.relevant).toBe(false);
  });

  it("defaults relevance to true when the field is missing or malformed", () => {
    const result = parseClassifyResult(
      JSON.stringify({ classification: "other", sentiment: "", title: "t", summary: "s", entities: [] })
    );
    expect(result.relevant).toBe(true);
  });

  it("keeps sentiment for complaints", () => {
    const result = parseClassifyResult(
      JSON.stringify({
        classification: "complaint",
        sentiment: "severe",
        title: "t",
        summary: "s",
        entities: []
      })
    );
    expect(result.classification).toBe(Classification.Complaint);
    expect(result.sentiment).toBe(Sentiment.Severe);
  });

  it("falls back to other/empty on unknown enum values", () => {
    const result = parseClassifyResult(
      JSON.stringify({
        classification: "weird_new_thing",
        sentiment: "apocalyptic",
        title: "t",
        summary: "s",
        entities: ["a", 42]
      })
    );
    expect(result.classification).toBe(Classification.Other);
    expect(result.sentiment).toBe("");
    expect(result.entities).toEqual(["a"]);
  });

  it("throws a clear error on unparseable JSON", () => {
    expect(() => parseClassifyResult("not json at all")).toThrow(/classification response/iu);
  });
});

describe("content_kind parsing", () => {
  it("passes evergreen through", () => {
    const result = parseClassifyResult(
      JSON.stringify({
        classification: "regulatory",
        sentiment: "",
        title: "T",
        summary: "S",
        entities: [],
        relevant: true,
        content_kind: "evergreen"
      })
    );
    expect(result.content_kind).toBe(ContentKind.Evergreen);
  });

  it("defaults missing or unknown content_kind to news", () => {
    const base = {
      classification: "regulatory",
      sentiment: "",
      title: "T",
      summary: "S",
      entities: [],
      relevant: true
    };
    expect(parseClassifyResult(JSON.stringify(base)).content_kind).toBe(ContentKind.News);
    expect(parseClassifyResult(JSON.stringify({ ...base, content_kind: "blog" })).content_kind).toBe(
      ContentKind.News
    );
  });
});

describe("content_kind in prompt", () => {
  it("instructs the news/evergreen distinction", () => {
    expect(SYSTEM_PROMPT).toContain("content_kind=news");
    expect(SYSTEM_PROMPT).toContain("content_kind=evergreen");
    expect(SYSTEM_PROMPT).toContain("dated event");
  });
});
