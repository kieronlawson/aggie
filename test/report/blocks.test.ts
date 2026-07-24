import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { type BlockMessage, digestMessages, type DigestMeta } from "#src/report/blocks.ts";

const digest = readFileSync(new URL("../fixtures/digest-competitor.md", import.meta.url), "utf8");

const meta: DigestMeta = {
  vertical: "competitor",
  reportDate: "2026-07-24",
  counts: { items: 12, clusters: 5 }
};

type LooseBlock = Record<string, unknown>;

const blockText = (block: LooseBlock): string => {
  const text = block["text"] as { text?: string } | undefined;
  const elements = block["elements"] as { text?: string }[] | undefined;
  return text?.text ?? elements?.[0]?.text ?? "";
};

const allText = (message: BlockMessage): string => message.blocks.map(blockText).join("\n");

describe("digestMessages card", () => {
  const { card } = digestMessages(meta, digest);

  it("opens with a header block naming the vertical and week", () => {
    expect(card.blocks[0]).toMatchObject({
      type: "header",
      text: { type: "plain_text", text: "Aggie — Competitor · week of 2026-07-24" }
    });
    expect(card.text).toBe("Aggie — Competitor · week of 2026-07-24");
  });

  it("shows counts as a context line and skips it when counts are unknown", () => {
    expect(blockText(card.blocks[1] as LooseBlock)).toBe("📡 12 items · 5 stories");
    const withoutCounts = digestMessages({ ...meta, counts: undefined }, digest);
    expect(blockText(withoutCounts.card.blocks[1] as LooseBlock)).not.toContain("items");
  });

  it("renders each signal as its own section with the story link as a URL button", () => {
    const signals = card.blocks.filter((block) => (block as { accessory?: unknown }).accessory !== undefined);
    expect(signals).toHaveLength(3);
    const first = signals[0] as { accessory: { type: string; url: string; text: { text: string } } };
    expect(first.accessory.type).toBe("button");
    expect(first.accessory.url).toContain("uctoday.com");
    expect(first.accessory.text.text).toBe("UC Today →");
    expect(blockText(first as LooseBlock)).not.toContain("uctoday.com");
  });

  it("keeps the lead-in, new-this-week list, and thread pointer", () => {
    const text = allText(card);
    expect(text).toContain("TCO story in the same breath");
    expect(text).toContain("⚡ SIGNALS");
    expect(text).toContain("🆕 NEW THIS WEEK");
    expect(text).toContain("• *RingCentral SMB price rise*");
    expect(blockText(card.blocks[card.blocks.length - 1] as LooseBlock)).toBe("🧵 Full digest in thread →");
  });
});

describe("digestMessages replies", () => {
  const { replies } = digestMessages(meta, digest);

  it("posts one reply per Details story, before the remaining sections", () => {
    const texts = replies.map(allText);
    expect(texts[0]).toContain("RingCentral raises SMB pricing");
    expect(texts[4]).toContain("GoTo Connect admin friction");
    expect(texts.filter((text) => text.includes("🔗 "))).toHaveLength(5);
  });

  it("moves story citations out of the prose into a source context line", () => {
    const story = replies[0] as BlockMessage;
    expect(blockText(story.blocks[0] as LooseBlock)).not.toContain("uctoday.com");
    expect(blockText(story.blocks[1] as LooseBlock)).toBe(
      "🔗 <https://www.uctoday.com/unified-communications/ringcentral-smb-price-rise-2026/|UC Today>"
    );
  });

  it("keeps the why-it-matters line as a quiet context block after the source line", () => {
    const story = replies[0] as BlockMessage;
    expect(blockText(story.blocks[2] as LooseBlock)).toContain("Why it matters — *Sales:*");
  });

  it("omits the why-it-matters line when a story has none", () => {
    const thetaLake = replies[3] as BlockMessage;
    expect(thetaLake.blocks).toHaveLength(2);
    expect(blockText(thetaLake.blocks[1] as LooseBlock)).toContain("🔗 ");
  });

  it("carries non-card sections through in order with context labels", () => {
    const texts = replies.map(allText);
    const continuing = texts.findIndex((text) => text.includes("🔁 CONTINUING STORIES"));
    const competitors = texts.findIndex((text) => text.includes("🏢 COMPETITOR SECTIONS"));
    const worthARead = texts.findIndex((text) => text.includes("📚 WORTH A READ"));
    expect(continuing).toBeGreaterThan(4);
    expect(competitors).toBeGreaterThan(continuing);
    expect(worthARead).toBeGreaterThan(competitors);
  });

  it("collapses manual checks and footer into a final context-only reply", () => {
    const ops = replies[replies.length - 1] as BlockMessage;
    expect(ops.blocks.every((block) => (block as { type?: string }).type === "context")).toBe(true);
    const text = allText(ops);
    expect(text).toContain("Manual checks");
    expect(text).toContain("No source failures");
  });
});

describe("digestMessages edge cases", () => {
  it("degrades a digest without recognised headings to a card plus generic replies", () => {
    const { card, replies } = digestMessages(meta, "Just a lead-in.\n\n## Odd section\n\nBody text.");
    expect(allText(card)).toContain("Just a lead-in.");
    expect(replies).toHaveLength(1);
    expect(allText(replies[0] as BlockMessage)).toContain("ODD SECTION");
  });

  it("splits section text that exceeds the block cap instead of overflowing one block", () => {
    const longStory = Array.from({ length: 200 }, () => "a sentence that pads the paragraph out").join(" ");
    const { replies } = digestMessages(meta, `Lead.\n\n## Details\n\n${longStory}`);
    const story = replies[0] as BlockMessage;
    expect(story.blocks.length).toBeGreaterThan(1);
    story.blocks.forEach((block) => {
      expect(blockText(block).length).toBeLessThanOrEqual(1900);
    });
  });

  it("renders a signal bullet without a link as a plain section", () => {
    const body = "Lead.\n\n## ⚡ Signals\n\n- 💼 **Sales:** nothing actionable this week";
    const { card } = digestMessages(meta, body);
    const signal = card.blocks.find((block) => blockText(block).includes("nothing actionable"));
    expect(signal).toBeDefined();
    expect((signal as { accessory?: unknown }).accessory).toBeUndefined();
  });
});
