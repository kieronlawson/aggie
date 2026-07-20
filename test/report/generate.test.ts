import { describe, expect, it } from "vitest";

import { Vertical } from "#src/registry/types.ts";
import { clusterSummaryPrompt, isEvergreen, SYNTHESIS_SYSTEM, synthesisPrompt, worthAReadSection } from "#src/report/generate.ts";

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

const ITEM = {
  id: "item:abc",
  story_id: "story:1",
  vector: [],
  url: "https://www.finra.org/media-center/newsreleases/2026/example",
  title: "FINRA example",
  summary: "A FINRA thing happened.",
  classification: "regulatory",
  competitor: "",
  relationship: "regulatory",
  published_at: "2026-07-18",
  merged_urls: [],
  content_kind: "",
  source: "FINRA press releases"
};

const SUMMARIES = ["FINRA fined a broker-dealer over off-channel texting (https://example.com/finra)."];
const PREVIOUS_BODY = "## New this week\n\nAn older story.";

describe("SYNTHESIS_SYSTEM voice", () => {
  it("defines Aggie's voice with factual guardrails", () => {
    expect(SYNTHESIS_SYSTEM).toContain("voice");
    expect(SYNTHESIS_SYSTEM).toContain("wry");
    expect(SYNTHESIS_SYSTEM).toContain("no invented details");
  });
});

describe("clusterSummaryPrompt", () => {
  it("demands markdown publisher links, never bare URLs", () => {
    const prompt = clusterSummaryPrompt([ITEM]);
    expect(prompt).toContain("[publisher name](url)");
    expect(prompt).toContain("never a bare URL");
    expect(prompt).toContain("A FINRA thing happened.");
  });
});

describe("synthesisPrompt", () => {
  const prompt = synthesisPrompt(Vertical.Finance, SUMMARIES, PREVIOUS_BODY);

  it("orders sections lead-in, signals, new, details, continuing", () => {
    const lead = prompt.indexOf("Lead-in");
    const signals = prompt.indexOf("## ⚡ Signals");
    const newThisWeek = prompt.indexOf("## 🆕 New this week");
    const details = prompt.indexOf("## Details");
    const continuing = prompt.indexOf("## 🔁 Continuing stories");
    expect(lead).toBeGreaterThanOrEqual(0);
    expect(lead).toBeLessThan(signals);
    expect(signals).toBeLessThan(newThisWeek);
    expect(newThisWeek).toBeLessThan(details);
    expect(details).toBeLessThan(continuing);
  });

  it("keeps signals role-tagged with emoji and a no-action fallback", () => {
    expect(prompt).toContain("💼 Sales");
    expect(prompt).toContain("📣 Marketing");
    expect(prompt).toContain("🛠️ Product");
    expect(prompt).toContain("👔 Leadership");
    expect(prompt).toContain("Nothing requiring action this week.");
  });

  it("keeps per-cluster commentary with the omit rule", () => {
    expect(prompt).toContain("_Why it matters — **<Role>:**");
    expect(prompt).toContain("Omit the line");
    expect(prompt).toContain("never write filler");
  });

  it("collapses unchanged continuing stories to a single line", () => {
    expect(prompt).toContain("no changes —");
    expect(prompt).toContain('Write "None." if there are no continuing stories.');
  });

  it("forbids bare URLs in the synthesis output", () => {
    expect(prompt).toContain("markdown link");
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

describe("evergreen handling", () => {
  it("treats missing content_kind as news", () => {
    expect(isEvergreen({ ...ITEM, content_kind: "" })).toBe(false);
    expect(isEvergreen({ ...ITEM, content_kind: "news" })).toBe(false);
    expect(isEvergreen({ ...ITEM, content_kind: "evergreen" })).toBe(true);
  });

  it("renders worth-a-read as linked one-liners", () => {
    const section = worthAReadSection([{ ...ITEM, content_kind: "evergreen" }]);
    expect(section).toContain("## 📚 Worth a read");
    expect(section).toContain("- [FINRA example](https://www.finra.org/media-center/newsreleases/2026/example) — A FINRA thing happened.");
  });

  it("renders nothing when there are no evergreen items", () => {
    expect(worthAReadSection([])).toBe("");
  });
});
