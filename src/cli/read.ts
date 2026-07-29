import { parseArgs } from "node:util";

import * as R from "ramda";

import { channelId, readMessages, readReplies, SlackChannel, type SlackMessage } from "#src/clients/slack.ts";
import { sequentially } from "#src/lib/async.ts";

const CHANNELS: string[] = Object.values(SlackChannel);
const DEFAULT_LIMIT = 20;
const JSON_INDENT = 2;

const parseChannel = (value: string): SlackChannel => {
  if (value.length === 0) {
    return SlackChannel.IntelStaging;
  }
  if (!R.includes(value, CHANNELS)) {
    throw new Error(`Unknown channel "${value}" — expected one of: ${CHANNELS.join(", ")}`);
  }
  return value as SlackChannel;
};

const parseLimit = (value: string): number => {
  if (value.length === 0) {
    return DEFAULT_LIMIT;
  }
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`Invalid --limit "${value}" — expected a positive integer`);
  }
  return limit;
};

type MessageWithReplies = SlackMessage & {
  replies?: SlackMessage[];
};

/** conversations.replies returns the parent as its first message — drop it to keep replies only. */
const withReplies = async (id: string, message: SlackMessage): Promise<MessageWithReplies> => {
  if ((message.reply_count ?? 0) === 0) {
    return message;
  }
  const thread = await readReplies(id, message.ts);
  return { ...message, replies: R.drop(1, thread) };
};

const main = async (): Promise<void> => {
  const { values } = parseArgs({ options: { channel: { type: "string" }, limit: { type: "string" } } });
  const channel = parseChannel(values.channel ?? "");
  const limit = parseLimit(values.limit ?? "");
  const id = await channelId(channel);
  const messages = await readMessages(id, limit);
  const expanded = await sequentially(messages, (message) => withReplies(id, message));
  console.log(JSON.stringify({ channel, messages: expanded }, null, JSON_INDENT));
};

await main().catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`aggie read failed: ${detail}`);
  process.exitCode = 1;
});
