import { describe, expect, it } from "vitest";

import { routeVertical } from "#src/pipeline/process.ts";
import { ItemVertical } from "#src/pipeline/types.ts";
import { Vertical } from "#src/registry/types.ts";

describe("routeVertical", () => {
  it("pins competitor-sourced items to competitor regardless of classification", () => {
    expect(routeVertical(Vertical.Competitor, ItemVertical.Healthcare)).toBe(Vertical.Competitor);
    expect(routeVertical(Vertical.Competitor, ItemVertical.None)).toBe(Vertical.Competitor);
  });

  it("moves misfiled items to their classified vertical", () => {
    expect(routeVertical(Vertical.Healthcare, ItemVertical.Finance)).toBe(Vertical.Finance);
    expect(routeVertical(Vertical.Finance, ItemVertical.Healthcare)).toBe(Vertical.Healthcare);
    expect(routeVertical(Vertical.Insurance, ItemVertical.Healthcare)).toBe(Vertical.Healthcare);
  });

  it("keeps generic (none) stories in the vertical that found them", () => {
    expect(routeVertical(Vertical.Finance, ItemVertical.None)).toBe(Vertical.Finance);
    expect(routeVertical(Vertical.Insurance, ItemVertical.None)).toBe(Vertical.Insurance);
    expect(routeVertical(Vertical.Healthcare, ItemVertical.None)).toBe(Vertical.Healthcare);
  });

  it("keeps a matching classification where it is", () => {
    expect(routeVertical(Vertical.Insurance, ItemVertical.Insurance)).toBe(Vertical.Insurance);
  });
});
