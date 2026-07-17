import { structuredJson } from "../clients/anthropic.js";
import { Classification, CLASSIFY_MODEL, Sentiment } from "../config.js";
import { collapseWhitespace, stripHtml } from "./normalize.js";
import type { ClassifiedFields, RawItem } from "./types.js";

const MAX_CONTENT_CHARS = 12000;

const CLASSIFY_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    classification: { type: "string", enum: Object.values(Classification) },
    sentiment: {
      anyOf: [{ type: "string", enum: Object.values(Sentiment) }, { type: "null" }],
      description: "Severity of the complaint; null unless classification is complaint"
    },
    title: { type: "string", description: "Concise factual headline for the item" },
    summary: { type: "string", description: "2-3 sentence summary of what happened and why it matters" },
    entities: {
      type: "array",
      items: { type: "string" },
      description: "Competitor and regulator names mentioned"
    }
  },
  required: ["classification", "sentiment", "title", "summary", "entities"],
  additionalProperties: false
};

const SYSTEM_PROMPT = [
  "You classify items for an internal competitive/regulatory intelligence tool used by a cloud",
  "telephony company (Spoke Phone) that sells compliant communications to finance, insurance and",
  "healthcare customers. Classify the item, extract a clean title, a 2-3 sentence summary, and the",
  "competitor/regulator entities mentioned. Rules: sentiment is only set for complaints (how severe",
  "the criticism is: mild / moderate / severe), otherwise null. Job postings are hiring_signal and",
  "the summary must mention role and location. Status-page incidents are outage. Enforcement",
  "actions, fines and consent orders are enforcement_action; new or amended rules are rule_change;",
  "regulator guidance is guidance; law-firm or trade-press analysis of regulatory events is",
  "commentary. Use other when nothing fits."
].join(" ");

const diffPreamble = (item: RawItem): string =>
  item.diff === ""
    ? ""
    : "The page CHANGED since the last crawl. Classify based on WHAT CHANGED (the diff), using the page as context.\n\nDIFF:\n" +
      `${item.diff.slice(0, MAX_CONTENT_CHARS)}\n\nPAGE CONTEXT:\n`;

const buildUserPrompt = (item: RawItem): string =>
  [
    `Source kind: ${item.sourceKind}`,
    `Vertical: ${item.vertical}`,
    `Relationship: ${item.relationship}${item.competitor === "" ? "" : ` (competitor: ${item.competitor})`}`,
    `URL: ${item.url}`,
    `Original title: ${collapseWhitespace(item.title)}`,
    "",
    diffPreamble(item) + collapseWhitespace(stripHtml(item.content)).slice(0, MAX_CONTENT_CHARS)
  ].join("\n");

type RawClassification = {
  classification?: string;
  sentiment?: string | null;
  title?: string;
  summary?: string;
  entities?: string[];
};

export const parseClassification = (raw: unknown): ClassifiedFields => {
  const fields = raw as RawClassification;
  const classification = Object.values(Classification).includes(fields.classification as Classification)
    ? (fields.classification as Classification)
    : Classification.Other;
  const sentiment = Object.values(Sentiment).includes(fields.sentiment as Sentiment)
    ? (fields.sentiment as Sentiment)
    : null;
  return {
    classification,
    sentiment: classification === Classification.Complaint ? sentiment : null,
    title: fields.title ?? "",
    summary: fields.summary ?? "",
    entities: fields.entities ?? []
  };
};

export const classifyItem = async (item: RawItem): Promise<ClassifiedFields> => {
  const raw = await structuredJson({
    model: CLASSIFY_MODEL,
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(item),
    schema: CLASSIFY_SCHEMA
  });
  return parseClassification(raw);
};
