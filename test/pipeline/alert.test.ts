import { describe, expect, it } from "vitest";

import { ALERT_SENTIMENT_THRESHOLD, alertMessage } from "#src/pipeline/alert.ts";
import { Classification, type ClassifyResult, ContentKind, ItemVertical, Sentiment } from "#src/pipeline/types.ts";

const classified = (overrides: Partial<ClassifyResult> = {}): ClassifyResult => ({
  classification: Classification.Outage,
  sentiment: "",
  title: "8x8 voice outage across US-East",
  summary: "8x8 confirmed degraded inbound and outbound calling for four hours.",
  entities: ["8x8"],
  relevant: true,
  content_kind: ContentKind.News,
  vertical: ItemVertical.None,
  ...overrides
});

const ITEM_URL = "https://status.8x8.com/incidents/abc123";

describe("alertMessage decision", () => {
  it("alerts on a relevant outage", () => {
    const message = alertMessage({ classified: classified(), url: ITEM_URL, competitor: "8x8" });
    expect(message).toBeDefined();
  });

  it("never alerts on an irrelevant item, even an outage", () => {
    const message = alertMessage({
      classified: classified({ relevant: false }),
      url: ITEM_URL,
      competitor: "8x8"
    });
    expect(message).toBeUndefined();
  });

  it("alerts on complaints at or above the moderate threshold", () => {
    const moderate = alertMessage({
      classified: classified({ classification: Classification.Complaint, sentiment: Sentiment.Moderate }),
      url: ITEM_URL,
      competitor: "8x8"
    });
    const severe = alertMessage({
      classified: classified({ classification: Classification.Complaint, sentiment: Sentiment.Severe }),
      url: ITEM_URL,
      competitor: "8x8"
    });
    expect(moderate).toBeDefined();
    expect(severe).toBeDefined();
  });

  it("stays quiet for mild complaints and complaints without sentiment", () => {
    const mild = alertMessage({
      classified: classified({ classification: Classification.Complaint, sentiment: Sentiment.Mild }),
      url: ITEM_URL,
      competitor: "8x8"
    });
    const missing = alertMessage({
      classified: classified({ classification: Classification.Complaint, sentiment: "" }),
      url: ITEM_URL,
      competitor: "8x8"
    });
    expect(mild).toBeUndefined();
    expect(missing).toBeUndefined();
  });

  it("stays quiet for every other classification", () => {
    const quiet = [
      Classification.PricingChange,
      Classification.ProductAnnouncement,
      Classification.EnforcementAction,
      Classification.HiringSignal,
      Classification.Other
    ].map((classification) =>
      alertMessage({ classified: classified({ classification }), url: ITEM_URL, competitor: "8x8" })
    );
    expect(quiet.every((message) => message === undefined)).toBe(true);
  });

  it("exposes the starting threshold from the tuning log", () => {
    expect(ALERT_SENTIMENT_THRESHOLD).toBe(Sentiment.Moderate);
  });
});

describe("alertMessage format", () => {
  it("labels an outage with the competitor and carries title, summary, and source link", () => {
    const message = alertMessage({ classified: classified(), url: ITEM_URL, competitor: "8x8" });
    expect(message?.text).toBe("🚨 Outage — 8x8: 8x8 voice outage across US-East");
    const rendered = JSON.stringify(message?.blocks);
    expect(rendered).toContain("🚨 *Outage — 8x8*");
    expect(rendered).toContain("8x8 voice outage across US-East");
    expect(rendered).toContain("degraded inbound and outbound calling");
    expect(rendered).toContain("<https://status.8x8.com/incidents/abc123|status.8x8.com>");
  });

  it("folds sentiment into the complaint label", () => {
    const message = alertMessage({
      classified: classified({
        classification: Classification.Complaint,
        sentiment: Sentiment.Severe,
        title: "GoTo Connect billing thread",
        summary: "A 400-upvote r/sysadmin thread aggregates billing complaints."
      }),
      url: "https://www.reddit.com/r/sysadmin/comments/xyz",
      competitor: "GoTo"
    });
    expect(message?.text).toBe("📣 Severe complaint — GoTo: GoTo Connect billing thread");
    expect(JSON.stringify(message?.blocks)).toContain("📣 *Severe complaint — GoTo*");
  });

  it("omits the competitor from the label when the item has none", () => {
    const message = alertMessage({ classified: classified(), url: ITEM_URL, competitor: "" });
    expect(message?.text).toBe("🚨 Outage: 8x8 voice outage across US-East");
  });
});
