import { requireEnv } from "#src/config.ts";

enum SlackChannel {
  IntelStaging = "#intel-staging",
  IntelDigest = "#intel-digest",
  IntelCompetitive = "#intel-competitive"
}

const SLACK_API_BASE = "https://slack.com/api";

type SlackResponse = {
  ok: boolean;
  error?: string;
  team?: string;
  user?: string;
  ts?: string;
};

const slackCall = async (method: string, body: Record<string, unknown>): Promise<SlackResponse> => {
  const response = await fetch(`${SLACK_API_BASE}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("SLACK_BOT_TOKEN")}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as SlackResponse;
  if (!payload.ok) {
    throw new Error(`Slack ${method} failed: ${payload.error ?? `HTTP ${String(response.status)}`}`);
  }
  return payload;
};

type SlackBlock = Record<string, unknown>;

/** `text` doubles as the notification fallback when `blocks` are provided. */
const postMessage = async (channel: SlackChannel, text: string, blocks?: SlackBlock[]): Promise<string> => {
  const payload = await slackCall("chat.postMessage", {
    channel,
    text,
    unfurl_links: false,
    unfurl_media: false,
    ...(blocks === undefined ? {} : { blocks })
  });
  return payload.ts ?? "";
};

type ThreadReplyOpts = {
  channel: SlackChannel;
  threadTs: string;
  text: string;
  blocks?: SlackBlock[];
};

const postThreadReply = async ({ channel, threadTs, text, blocks }: ThreadReplyOpts): Promise<void> => {
  await slackCall("chat.postMessage", {
    channel,
    text,
    thread_ts: threadTs,
    unfurl_links: false,
    unfurl_media: false,
    ...(blocks === undefined ? {} : { blocks })
  });
};

const authTest = async (): Promise<string> => {
  const payload = await slackCall("auth.test", {});
  return `team ${payload.team ?? "?"}, bot ${payload.user ?? "?"}`;
};

export { authTest, postMessage, postThreadReply, type SlackBlock, SlackChannel };
