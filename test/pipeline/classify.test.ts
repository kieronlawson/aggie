import { describe, expect, it } from "vitest";

import { parseClassifyResult } from "#src/pipeline/classify.ts";
import { Classification, Sentiment } from "#src/pipeline/types.ts";

describe("parseClassifyResult", () => {
  it("parses a valid structured response", () => {
    const result = parseClassifyResult(
      JSON.stringify({
        classification: "enforcement_action",
        sentiment: "",
        title: "SEC fines broker-dealer",
        summary: "The SEC fined a firm for recordkeeping failures.",
        entities: ["SEC"]
      })
    );
    expect(result.classification).toBe(Classification.EnforcementAction);
    expect(result.sentiment).toBe("");
    expect(result.entities).toEqual(["SEC"]);
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
