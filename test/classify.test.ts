import { describe, expect, it } from "vitest";
import { Classification, Sentiment } from "../src/config.js";
import { parseClassification } from "../src/pipeline/classify.js";

describe("parseClassification", () => {
  it("keeps sentiment only for complaints", () => {
    const complaint = parseClassification({
      classification: "complaint",
      sentiment: "severe",
      title: "t",
      summary: "s",
      entities: ["Aircall"]
    });
    expect(complaint.classification).toBe(Classification.Complaint);
    expect(complaint.sentiment).toBe(Sentiment.Severe);
  });

  it("nulls sentiment for non-complaints even if the model returns one", () => {
    const outage = parseClassification({ classification: "outage", sentiment: "severe" });
    expect(outage.classification).toBe(Classification.Outage);
    expect(outage.sentiment).toBeNull();
  });

  it("falls back to other for unknown classifications", () => {
    expect(parseClassification({ classification: "nonsense" }).classification).toBe(Classification.Other);
  });
});
