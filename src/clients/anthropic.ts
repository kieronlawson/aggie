import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | undefined;

const client = (): Anthropic => {
  cachedClient = cachedClient ?? new Anthropic();
  return cachedClient;
};

const STOP_REASON_REFUSAL = "refusal";
const STRUCTURED_MAX_TOKENS = 2048;
const TEXT_MAX_TOKENS = 16000;

export type StructuredCall = {
  model: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
};

const collectText = (content: readonly Anthropic.ContentBlock[]): string =>
  content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

export const structuredJson = async (call: StructuredCall): Promise<unknown> => {
  const response = await client().messages.create({
    model: call.model,
    max_tokens: STRUCTURED_MAX_TOKENS,
    system: call.system,
    messages: [{ role: "user", content: call.user }],
    output_config: { format: { type: "json_schema", schema: call.schema } }
  });
  if (response.stop_reason === STOP_REASON_REFUSAL) {
    throw new Error("Model refused structured request");
  }
  return JSON.parse(collectText(response.content));
};

export type TextCall = {
  model: string;
  system: string;
  user: string;
};

export const generateText = async (call: TextCall): Promise<string> => {
  const response = await client().messages.create({
    model: call.model,
    max_tokens: TEXT_MAX_TOKENS,
    thinking: { type: "adaptive" },
    system: call.system,
    messages: [{ role: "user", content: call.user }]
  });
  if (response.stop_reason === STOP_REASON_REFUSAL) {
    throw new Error("Model refused text request");
  }
  return collectText(response.content);
};

export const checkAnthropicAuth = async (): Promise<string> => {
  const model = await client().models.retrieve("claude-haiku-4-5");
  return model.id;
};
