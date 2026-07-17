import { describe, expect, it } from "vitest";

import { DedupeVerdict } from "#src/pipeline/types.ts";
import { parseVerdict } from "#src/pipeline/verdict.ts";

describe("parseVerdict", () => {
  it("parses each valid verdict", () => {
    expect(parseVerdict('{"verdict": "duplicate"}')).toBe(DedupeVerdict.Duplicate);
    expect(parseVerdict('{"verdict": "same_story"}')).toBe(DedupeVerdict.SameStory);
    expect(parseVerdict('{"verdict": "distinct"}')).toBe(DedupeVerdict.Distinct);
  });

  it("tolerates surrounding prose and code fences", () => {
    expect(parseVerdict('Here you go:\n```json\n{"verdict": "duplicate"}\n```')).toBe(DedupeVerdict.Duplicate);
  });

  it("falls back to distinct on garbage — never merges on an unparseable verdict", () => {
    expect(parseVerdict("unsure, maybe the same?")).toBe(DedupeVerdict.Distinct);
    expect(parseVerdict('{"verdict": "kinda-similar"}')).toBe(DedupeVerdict.Distinct);
    expect(parseVerdict("")).toBe(DedupeVerdict.Distinct);
  });
});
