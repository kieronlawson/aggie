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

type SlackChannelInfo = {
  id: string;
  name: string;
};

type SlackMessage = {
  ts: string;
  text?: string;
  thread_ts?: string;
};

type SlackReadResponse = SlackResponse & {
  channels?: SlackChannelInfo[];
  messages?: SlackMessage[];
  response_metadata?: { next_cursor?: string };
};

/** Read methods take query params, not JSON bodies. */
const slackGet = async (method: string, params: Record<string, string>): Promise<SlackReadResponse> => {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${SLACK_API_BASE}/${method}?${query}`, {
    headers: { Authorization: `Bearer ${requireEnv("SLACK_BOT_TOKEN")}` }
  });
  const payload = (await response.json()) as SlackReadResponse;
  if (!payload.ok) {
    throw new Error(`Slack ${method} failed: ${payload.error ?? `HTTP ${String(response.status)}`}`);
  }
  return payload;
};

const CHANNEL_PAGE_LIMIT = "200";

const channelId = async (channel: SlackChannel, cursor?: string): Promise<string> => {
  const payload = await slackGet("conversations.list", {
    limit: CHANNEL_PAGE_LIMIT,
    ...(cursor === undefined ? {} : { cursor })
  });
  const bareName = channel.slice(1);
  const match = (payload.channels ?? []).find((info) => info.name === bareName);
  if (match !== undefined) {
    return match.id;
  }
  const nextCursor = payload.response_metadata?.next_cursor;
  if (nextCursor === undefined || nextCursor.length === 0) {
    throw new Error(`Slack channel ${channel} not found via conversations.list`);
  }
  return channelId(channel, nextCursor);
};

const readMessages = async (channel: SlackChannel, limit: number): Promise<SlackMessage[]> => {
  const id = await channelId(channel);
  const payload = await slackGet("conversations.history", { channel: id, limit: String(limit) });
  return payload.messages ?? [];
};

export {
  authTest,
  postMessage,
  postThreadReply,
  readMessages,
  type SlackBlock,
  SlackChannel,
  type SlackMessage
};
