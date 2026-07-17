import { describe, expect, it } from "vitest";
import { Classification, Sentiment } from "../src/config.js";
import { shouldAlert } from "../src/pipeline/alerts.js";

describe("shouldAlert", () => {
  it("always alerts on outages", () => {
    expect(shouldAlert(Classification.Outage, "", Sentiment.Moderate)).toBe(true);
  });

  it("alerts on complaints at or above the sentiment threshold", () => {
    expect(shouldAlert(Classification.Complaint, Sentiment.Severe, Sentiment.Moderate)).toBe(true);
    expect(shouldAlert(Classification.Complaint, Sentiment.Moderate, Sentiment.Moderate)).toBe(true);
  });

  it("does not alert on complaints below the threshold", () => {
    expect(shouldAlert(Classification.Complaint, Sentiment.Mild, Sentiment.Moderate)).toBe(false);
  });

  it("does not alert on other classifications", () => {
    expect(shouldAlert(Classification.ProductAnnouncement, "", Sentiment.Mild)).toBe(false);
    expect(shouldAlert(Classification.HiringSignal, "", Sentiment.Mild)).toBe(false);
  });
});
