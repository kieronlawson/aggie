import { requireEnv } from "../config.js";
import { fetchJson } from "../lib/http.js";

const POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage";
const AUTH_TEST_URL = "https://slack.com/api/auth.test";
const MAX_MESSAGE_LENGTH = 39000;

type SlackResponse = { ok?: boolean; error?: string; ts?: string };

const callSlack = async (url: string, body: Record<string, unknown>): Promise<SlackResponse> => {
  const result = (await fetchJson(url, {
    method: "POST",
    headers: { authorization: `Bearer ${requireEnv("SLACK_BOT_TOKEN")}` },
    body
  })) as SlackResponse;
  if (result.ok !== true) {
    throw new Error(`Slack error: ${result.error ?? "unknown"}`);
  }
  return result;
};

const splitMessage = (text: string): string[] =>
  text.length <= MAX_MESSAGE_LENGTH
    ? [text]
    : [text.slice(0, MAX_MESSAGE_LENGTH), ...splitMessage(text.slice(MAX_MESSAGE_LENGTH))];

export const postMessage = async (channel: string, text: string): Promise<void> => {
  const parts = splitMessage(text);
  await parts.reduce<Promise<void>>(async (accPromise, part) => {
    await accPromise;
    await callSlack(POST_MESSAGE_URL, { channel, text: part, unfurl_links: false });
  }, Promise.resolve());
};

export const checkSlackAuth = async (): Promise<string> => {
  const result = (await callSlack(AUTH_TEST_URL, {})) as SlackResponse & { user?: string };
  return result.user ?? "ok";
};
