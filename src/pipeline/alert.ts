import { postMessage, type SlackBlock, SlackChannel } from "#src/clients/slack.ts";
import { Classification, type ClassifyResult, Sentiment } from "#src/pipeline/types.ts";

/**
 * Complaint alert floor. Changes must be logged in docs/tuning-log.md with
 * date and reason. Outages are not sentiment-gated: classification only
 * permits `outage` for occurred, unplanned incidents.
 */
const ALERT_SENTIMENT_THRESHOLD = Sentiment.Moderate;

const SENTIMENT_RANK: Record<Sentiment, number> = {
  [Sentiment.Mild]: 0,
  [Sentiment.Moderate]: 1,
  [Sentiment.Severe]: 2
};

/**
 * Alerts stay in staging until the alert-quality gate promotes them to
 * #intel-competitive (plan §4 gate, pending Kieron's review).
 */
const ALERT_CHANNEL = SlackChannel.IntelStaging;

const OUTAGE_EMOJI = "🚨";
const COMPLAINT_EMOJI = "📣";

type AlertMessage = {
  text: string;
  blocks: SlackBlock[];
};

type AlertMessageOpts = {
  classified: ClassifyResult;
  url: string;
  competitor: string;
};

const NO_SENTIMENT = "" as const;

const meetsThreshold = (sentiment: Sentiment | typeof NO_SENTIMENT): boolean =>
  sentiment !== NO_SENTIMENT && SENTIMENT_RANK[sentiment] >= SENTIMENT_RANK[ALERT_SENTIMENT_THRESHOLD];

const capitalize = (word: string): string => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;

const HOST_PATTERN = /^https?:\/\/(?:www\.)?([^/]+)/u;

const linkHost = (url: string): string => HOST_PATTERN.exec(url)?.[1] ?? url;

const withCompetitor = (label: string, competitor: string): string =>
  competitor.length === 0 ? label : `${label} — ${competitor}`;

type AlertShape = {
  emoji: string;
  label: string;
};

const alertShape = ({ classified, competitor }: AlertMessageOpts): AlertShape | undefined => {
  if (!classified.relevant) {
    return undefined;
  }
  if (classified.classification === Classification.Outage) {
    return { emoji: OUTAGE_EMOJI, label: withCompetitor("Outage", competitor) };
  }
  if (classified.classification === Classification.Complaint && meetsThreshold(classified.sentiment)) {
    const label = withCompetitor(`${capitalize(classified.sentiment)} complaint`, competitor);
    return { emoji: COMPLAINT_EMOJI, label };
  }
  return undefined;
};

/**
 * The immediate-alert decision and format in one pure step: a relevant
 * occurred outage, or a complaint at/above the sentiment threshold, becomes
 * a Slack message; everything else returns undefined.
 */
const alertMessage = (opts: AlertMessageOpts): AlertMessage | undefined => {
  const shape = alertShape(opts);
  if (shape === undefined) {
    return undefined;
  }
  const { classified, url } = opts;
  return {
    text: `${shape.emoji} ${shape.label}: ${classified.title}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `${shape.emoji} *${shape.label}*: ${classified.title}\n${classified.summary}` }
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `🔗 <${url}|${linkHost(url)}>` }]
      }
    ]
  };
};

const postAlert = async (message: AlertMessage): Promise<void> => {
  await postMessage(ALERT_CHANNEL, message.text, message.blocks);
};

export { ALERT_SENTIMENT_THRESHOLD, type AlertMessage, alertMessage, postAlert };
