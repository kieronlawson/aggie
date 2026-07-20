import { describe, expect, it } from "vitest";

import { Vertical } from "#src/registry/types.ts";
import { SYNTHESIS_SYSTEM, synthesisPrompt } from "#src/report/generate.ts";

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

const SUMMARIES = ["FINRA fined a broker-dealer over off-channel texting (https://example.com/finra)."];
const PREVIOUS_BODY = "## New this week\n\nAn older story.";

describe("synthesisPrompt", () => {
  const prompt = synthesisPrompt(Vertical.Finance, SUMMARIES, PREVIOUS_BODY);

  it("orders the sections signals, new this week, continuing", () => {
    const signals = prompt.indexOf("## This week's signals");
    const newThisWeek = prompt.indexOf("## New this week");
    const continuing = prompt.indexOf("## Continuing stories");
    expect(signals).toBeGreaterThanOrEqual(0);
    expect(signals).toBeLessThan(newThisWeek);
    expect(newThisWeek).toBeLessThan(continuing);
  });

  it("caps signals at 2-3 role-tagged bullets with a no-action fallback", () => {
    expect(prompt).toContain("2-3 most actionable");
    expect(prompt).toContain("**<Role>:**");
    expect(prompt).toContain("Nothing requiring action this week.");
  });

  it("asks for per-cluster commentary only when a concrete use exists", () => {
    expect(prompt).toContain("_Why it matters — **<Role>:**");
    expect(prompt).toContain("Omit the line");
    expect(prompt).toContain("worth monitoring");
  });

  it("includes competitor sections only for the competitor vertical", () => {
    expect(prompt).not.toContain("## Competitor sections");
    const competitorPrompt = synthesisPrompt(Vertical.Competitor, SUMMARIES, PREVIOUS_BODY);
    expect(competitorPrompt).toContain("## Competitor sections");
  });

  it("threads the summaries and previous digest through", () => {
    expect(prompt).toContain("- FINRA fined a broker-dealer");
    expect(prompt).toContain("An older story.");
  });
});
