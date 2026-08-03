import { describe, expect, it } from "vitest";

import { Vertical } from "#src/registry/types.ts";
import {
  capClusters,
  capPerDomain,
  clusterSummaryPrompt,
  isEvergreen,
  itemDomain,
  SYNTHESIS_SYSTEM,
  synthesisPrompt,
  worthAReadSection
} from "#src/report/generate.ts";

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

  it("forbids figures that are not verbatim in the items", () => {
    const prompt = clusterSummaryPrompt([ITEM]);
    expect(prompt).toContain("verbatim");
    expect(prompt).toContain("stay vague");
  });
});

describe("SYNTHESIS_SYSTEM figure grounding", () => {
  it("forbids figures that are not verbatim in the cluster summaries", () => {
    expect(SYNTHESIS_SYSTEM).toContain("verbatim in the cluster summaries");
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
    expect(prompt).toContain("Omit the section entirely");
  });

  it("forbids empty parentheses in signals", () => {
    expect(prompt).toContain('never write empty parentheses "()"');
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

describe("itemDomain", () => {
  it("strips www and returns the bare hostname", () => {
    expect(itemDomain("https://www.finra.org/media-center/x")).toBe("finra.org");
    expect(itemDomain("https://tcpaworld.com/2026/07/28/post/")).toBe("tcpaworld.com");
  });

  it("returns empty for garbage URLs", () => {
    expect(itemDomain("not a url")).toBe("");
  });
});

const itemFrom = (url: string, publishedAt: string): typeof ITEM => ({
  ...ITEM,
  url,
  published_at: publishedAt
});

describe("capPerDomain", () => {
  const tcpaworld = [...Array(8).keys()].map((n) =>
    itemFrom(`https://tcpaworld.com/post-${String(n)}`, `2026-07-2${String(8 - n)}`)
  );
  const others = [
    itemFrom("https://natlawreview.com/article/one", "2026-07-30"),
    itemFrom("https://www.jdsupra.com/legalnews/two", "2026-07-24")
  ];

  it("keeps only the first N items per domain, preserving order", () => {
    const mixed = [others[0], ...tcpaworld, others[1]] as typeof tcpaworld;
    const capped = capPerDomain(mixed, 3);
    expect(capped.map((item) => item.url)).toEqual([
      "https://natlawreview.com/article/one",
      "https://tcpaworld.com/post-0",
      "https://tcpaworld.com/post-1",
      "https://tcpaworld.com/post-2",
      "https://www.jdsupra.com/legalnews/two"
    ]);
  });

  it("passes everything through when under the cap", () => {
    expect(capPerDomain(others, 3)).toEqual(others);
  });
});

describe("capClusters", () => {
  const single = [itemFrom("https://a.com/1", "2026-07-31")];
  const older = [itemFrom("https://b.com/1", "2026-07-20")];
  const multi = [itemFrom("https://c.com/1", "2026-07-21"), itemFrom("https://d.com/1", "2026-07-22")];

  it("prefers larger clusters, then newer ones", () => {
    expect(capClusters([single, older, multi], 2)).toEqual([multi, single]);
  });

  it("passes everything through when under the cap", () => {
    expect(capClusters([single, multi], 5)).toHaveLength(2);
  });
});
