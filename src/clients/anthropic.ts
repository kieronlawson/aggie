import Anthropic from "@anthropic-ai/sdk";

import { requireEnv } from "#src/config.ts";

const HAIKU_MODEL = "claude-haiku-4-5";
const OPUS_MODEL = "claude-opus-4-8";
const TEXT_BLOCK_TYPE = "text";
const PING_MAX_TOKENS = 8;

const createAnthropic = (): Anthropic => new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });

const pingModel = async (model: string): Promise<string> => {
  const response = await createAnthropic().messages.create({
    model,
    max_tokens: PING_MAX_TOKENS,
    messages: [{ role: "user", content: "Reply with the single word: pong" }]
  });
  return response.model;
};

export { createAnthropic, HAIKU_MODEL, OPUS_MODEL, pingModel, TEXT_BLOCK_TYPE };
