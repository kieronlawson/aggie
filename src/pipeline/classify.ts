import * as R from "ramda";

import { createAnthropic, HAIKU_MODEL, TEXT_BLOCK_TYPE } from "#src/clients/anthropic.ts";
import { Classification, type ClassifyResult, ContentKind, type RawItem, Sentiment } from "#src/pipeline/types.ts";

const CLASSIFY_MAX_TOKENS = 1024;
const ERROR_SNIPPET_LENGTH = 200;

const CLASSIFICATIONS: string[] = Object.values(Classification);
const SENTIMENTS: string[] = Object.values(Sentiment);
const CONTENT_KINDS: string[] = Object.values(ContentKind);

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    classification: { type: "string", enum: CLASSIFICATIONS },
    sentiment: { type: "string", enum: ["", ...SENTIMENTS] },
    title: { type: "string" },
    summary: { type: "string", description: "2-3 sentence summary" },
    entities: { type: "array", items: { type: "string" } },
    relevant: { type: "boolean" },
    content_kind: { type: "string", enum: CONTENT_KINDS }
  },
  required: ["classification", "sentiment", "title", "summary", "entities", "relevant", "content_kind"],
  additionalProperties: false
} as const;

const SYSTEM_PROMPT =
  "You classify intel items for Spoke Phone, a cloud phone system vendor selling into regulated " +
  "verticals (finance, insurance, healthcare). Classify the item, extract a clean title, write a " +
  "2-3 sentence summary, and list competitor/regulator entities mentioned. sentiment applies to " +
  "complaints only (mild/moderate/severe); use an empty string otherwise.\n\n" +
  "Set relevant=true ONLY when the item is either:\n" +
  "(a) regulatory/legal news that touches BUSINESS COMMUNICATIONS compliance — recordkeeping or " +
  "retention of electronic communications (voice, SMS, WhatsApp, email, video), off-channel " +
  "communications enforcement, call recording/monitoring or consent rules, e-comms supervision " +
  "and surveillance, telemarketing/robocall rules, or communications archiving obligations; or\n" +
  "(b) intelligence about these companies: RingCentral, 8x8, Aircall, UJET, Twilio/Twilio Flex, " +
  "Theta Lake, Smarsh — products, pricing, outages, complaints, hiring, partnerships, M&A, or " +
  "their SEC filings.\n" +
  "Set relevant=false for everything else — e.g. general privacy/data-broker/breach laws, AI or " +
  "crypto regulation, ESG, employment law, tax, or securities-market news with no communications " +
  "angle. When genuinely unsure, prefer relevant=true.\n\n" +
  "Set content_kind=news when the item reports a dated event — an enforcement action, rule " +
  "proposal or adoption, court decision, filing, announcement, incident, or personnel change. " +
  "Set content_kind=evergreen for undated guidance, how-tos, best-practice explainers, webinars, " +
  "or vendor thought leadership — content that would read the same whichever week it was " +
  "published. When genuinely unsure, prefer news.";

const buildClassifyPrompt = (item: RawItem): string =>
  [
    `Vertical: ${item.vertical}`,
    `Relationship: ${item.relationship}`,
    item.competitor.length > 0 ? `Competitor: ${item.competitor}` : "",
    `Source URL: ${item.url}`,
    `Published: ${item.published_at}`,
    "",
    `# ${item.title}`,
    "",
    item.content
  ]
    .filter((line) => line.length > 0)
    .join("\n");

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? (R.filter((entry) => typeof entry === "string", value)) : [];

const parseClassifyResult = (text: string): ClassifyResult => {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const classification = parsed["classification"];
    const sentiment = parsed["sentiment"];
    return {
      classification: R.includes(classification, CLASSIFICATIONS)
        ? (classification as Classification)
        : Classification.Other,
      sentiment: R.includes(sentiment, SENTIMENTS) ? (sentiment as Sentiment) : "",
      title: typeof parsed["title"] === "string" ? parsed["title"] : "",
      summary: typeof parsed["summary"] === "string" ? parsed["summary"] : "",
      entities: asStringArray(parsed["entities"]),
      relevant: typeof parsed["relevant"] === "boolean" ? parsed["relevant"] : true,
      content_kind:
        parsed["content_kind"] === ContentKind.Evergreen ? ContentKind.Evergreen : ContentKind.News
    };
  } catch {
    throw new Error(`Unparseable classification response: ${text.slice(0, ERROR_SNIPPET_LENGTH)}`);
  }
};

const classifyItem = async (item: RawItem): Promise<ClassifyResult> => {
  const response = await createAnthropic().messages.create({
    model: HAIKU_MODEL,
    max_tokens: CLASSIFY_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: CLASSIFY_SCHEMA } },
    messages: [{ role: "user", content: buildClassifyPrompt(item) }]
  });
  const block = response.content[0];
  if (block === undefined || block.type !== TEXT_BLOCK_TYPE) {
    throw new Error(`Classification returned no text block (stop_reason: ${response.stop_reason ?? "?"})`);
  }
  return parseClassifyResult(block.text);
};

export { buildClassifyPrompt, classifyItem, parseClassifyResult, SYSTEM_PROMPT };
