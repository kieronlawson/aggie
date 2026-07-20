import { describe, expect, it } from "vitest";

import { SYNTHESIS_SYSTEM } from "#src/report/generate.ts";

describe("SYNTHESIS_SYSTEM", () => {
  it("grounds the model in Spoke's product and verticals", () => {
    expect(SYNTHESIS_SYSTEM).toContain("compliance call recording");
    expect(SYNTHESIS_SYSTEM).toContain("finance, insurance, healthcare");
  });

  it("describes how each reader role uses intel", () => {
    expect(SYNTHESIS_SYSTEM).toContain("Sales:");
    expect(SYNTHESIS_SYSTEM).toContain("Marketing:");
    expect(SYNTHESIS_SYSTEM).toContain("Product:");
    expect(SYNTHESIS_SYSTEM).toContain("Leadership:");
  });

  it("keeps the partner framing", () => {
    expect(SYNTHESIS_SYSTEM).toContain("Theta Lake");
    expect(SYNTHESIS_SYSTEM).toContain("Smarsh");
  });
});
