/**
 * One-off recovery (2026-07-24): the competitor digest force re-run regenerated
 * content instead of reposting, so #intel-competitive got a different digest to
 * the one reviewed in #intel-staging. This copies the original staging card and
 * thread verbatim to #intel-competitive (the regenerated post was already
 * deleted by hand). Delete this file (and its workflow) once the restore has run.
 */
import { postMessage, postThreadReply, SlackChannel } from "#src/clients/slack.ts";
import { requireEnv } from "#src/config.ts";
import { sequentially } from "#src/lib/async.ts";

const SLACK_API_BASE = "https://slack.com/api";
const STAGING_NAME = "intel-staging";
const COMPETITIVE_NAME = "intel-competitive";
const CARD_MARKER = "Aggie · competitor · week of 2026-07-24";
const PAGE_LIMIT = 200;
const HISTORY_LIMIT = 100;

type SlackMessage = {
  ts: string;
  text?: string;
  bot_id?: string;
};

type SlackReadResponse = {
  ok: boolean;
  error?: string;
  channels?: { id: string; name: string }[];
  messages?: SlackMessage[];
  response_metadata?: { next_cursor?: string };
};

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

const findChannelId = async (name: string, cursor: string): Promise<string | undefined> => {
  const payload = await slackGet("conversations.list", {
    types: "public_channel",
    exclude_archived: "true",
    limit: String(PAGE_LIMIT),
    ...(cursor.length === 0 ? {} : { cursor })
  });
  const match = (payload.channels ?? []).find((channel) => channel.name === name);
  if (match !== undefined) {
    return match.id;
  }
  const next = payload.response_metadata?.next_cursor ?? "";
  return next.length === 0 ? undefined : findChannelId(name, next);
};

const channelIdOf = async (name: string): Promise<string> => {
  const id = await findChannelId(name, "");
  if (id === undefined) {
    throw new Error(`Channel #${name} not found — is the bot missing the channels:read scope?`);
  }
  return id;
};

const findDigestCard = async (channelId: string, channelName: string): Promise<SlackMessage> => {
  const payload = await slackGet("conversations.history", { channel: channelId, limit: String(HISTORY_LIMIT) });
  const card = (payload.messages ?? []).find((message) => (message.text ?? "").includes(CARD_MARKER));
  if (card === undefined) {
    throw new Error(`No "${CARD_MARKER}" card in the latest ${String(HISTORY_LIMIT)} messages of #${channelName}`);
  }
  return card;
};

/** Thread replies (oldest first), excluding the parent and anything not posted by the digest bot. */
const fetchThreadReplies = async (channelId: string, card: SlackMessage): Promise<SlackMessage[]> => {
  const payload = await slackGet("conversations.replies", {
    channel: channelId,
    ts: card.ts,
    limit: String(HISTORY_LIMIT)
  });
  return (payload.messages ?? []).filter(
    (message) => message.ts !== card.ts && (card.bot_id === undefined || message.bot_id === card.bot_id)
  );
};

const main = async (): Promise<void> => {
  const stagingId = await channelIdOf(STAGING_NAME);
  const original = await findDigestCard(stagingId, STAGING_NAME);
  const originalReplies = await fetchThreadReplies(stagingId, original);
  console.log(`Original: ts ${original.ts} +${String(originalReplies.length)} thread msgs in #${STAGING_NAME}.`);
  const repostTs = await postMessage(SlackChannel.IntelCompetitive, original.text ?? "");
  await sequentially(originalReplies, async (reply) => {
    await postThreadReply(SlackChannel.IntelCompetitive, repostTs, reply.text ?? "");
  });
  console.log(`Reposted the original digest to #${COMPETITIVE_NAME} (ts ${repostTs}).`);
};

await main().catch(async (error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`aggie restore-competitive failed: ${detail}`);
  process.exitCode = 1;
  await postMessage(SlackChannel.IntelStaging, `❌ aggie restore-competitive failed: ${detail}`).catch(() => undefined);
});
