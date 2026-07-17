import { postMessage } from "../clients/slack.js";
import { Classification, Sentiment, alertChannel, alertSentimentThreshold } from "../config.js";
import type { StoredItem } from "./types.js";

const SENTIMENT_RANK: Record<Sentiment, number> = {
  [Sentiment.Mild]: 1,
  [Sentiment.Moderate]: 2,
  [Sentiment.Severe]: 3
};

const rankOf = (sentiment: string): number => SENTIMENT_RANK[sentiment as Sentiment] ?? 0;

// Alert branch from spec §P: complaint at/above the sentiment threshold, or
// any outage, posts immediately to the alert channel.
export const shouldAlert = (
  classification: Classification,
  sentiment: string,
  threshold: Sentiment
): boolean => {
  if (classification === Classification.Outage) {
    return true;
  }
  if (classification !== Classification.Complaint) {
    return false;
  }
  return rankOf(sentiment) >= rankOf(threshold);
};

const alertLabel = (item: StoredItem): string =>
  item.classification === Classification.Outage ? ":rotating_light: Outage" : ":warning: Complaint";

export const maybePostAlert = async (item: StoredItem): Promise<boolean> => {
  if (!shouldAlert(item.classification, item.sentiment, alertSentimentThreshold())) {
    return false;
  }
  const competitorPart = item.competitor === "" ? "" : ` — ${item.competitor}`;
  const sentimentPart = item.sentiment === "" ? "" : ` (${item.sentiment})`;
  const text = [
    `${alertLabel(item)}${competitorPart}${sentimentPart}`,
    `*${item.title}*`,
    item.summary,
    item.url
  ].join("\n");
  await postMessage(alertChannel(), text);
  return true;
};
