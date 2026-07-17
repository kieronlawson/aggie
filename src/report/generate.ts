import * as R from "ramda";

import { createAnthropic, HAIKU_MODEL, OPUS_MODEL, TEXT_BLOCK_TYPE } from "#src/clients/anthropic.ts";
import { queryRows, TpufNamespace, type TpufResultRow, upsertRows } from "#src/clients/turbopuffer.ts";
import { embed } from "#src/clients/voyage.ts";
import { sequentially } from "#src/lib/async.ts";
import { itemsNamespaceFor } from "#src/pipeline/process.ts";
import { Vertical } from "#src/registry/types.ts";
import { clusterItems } from "#src/report/cluster.ts";

const WEEK_MS = 604_800_000;
const ITEMS_QUERY_LIMIT = 1000;
const SUMMARY_MAX_TOKENS = 512;
const SYNTHESIS_MAX_TOKENS = 8192;

type ReportItem = {
  id: string;
  story_id: string;
  vector: number[];
  url: string;
  title: string;
  summary: string;
  classification: string;
  competitor: string;
  relationship: string;
  published_at: string;
  merged_urls: string[];
};

const ITEM_ATTRIBUTES = [
  "vector",
  "story_id",
  "url",
  "title",
  "summary",
  "classification",
  "competitor",
  "relationship",
  "published_at",
  "merged_urls"
];

const str = (row: TpufResultRow, key: string): string => {
  const value = row[key];
  return typeof value === "string" ? value : "";
};

const rowToReportItem = (row: TpufResultRow): ReportItem => ({
  id: String(row.id),
  story_id: str(row, "story_id"),
  vector: Array.isArray(row["vector"]) ? (row["vector"]) : [],
  url: str(row, "url"),
  title: str(row, "title"),
  summary: str(row, "summary"),
  classification: str(row, "classification"),
  competitor: str(row, "competitor"),
  relationship: str(row, "relationship"),
  published_at: str(row, "published_at"),
  merged_urls: Array.isArray(row["merged_urls"]) ? (row["merged_urls"] as string[]) : []
});

const fetchWeekItems = async (vertical: Vertical): Promise<ReportItem[]> => {
  const rows = await queryRows({
    namespace: itemsNamespaceFor(vertical),
    filters: [
      "And",
      [
        ["published_at_ms", "Gte", Date.now() - WEEK_MS],
        ["relevant", "Eq", true]
      ]
    ],
    topK: ITEMS_QUERY_LIMIT,
    includeAttributes: ITEM_ATTRIBUTES,
    orderBy: ["published_at_ms", "desc"]
  });
  return R.map(rowToReportItem, rows);
};

const clusterLine = (item: ReportItem): string => {
  const reprints = item.merged_urls.length > 0 ? ` (reprints: ${item.merged_urls.join(", ")})` : "";
  return `- [${item.classification}] ${item.title} — ${item.summary} (${item.url}${reprints}, ${item.published_at})`;
};

const askText = async (model: string, maxTokens: number, prompt: string, system?: string): Promise<string> => {
  const response = await createAnthropic().messages.create({
    model,
    max_tokens: maxTokens,
    ...(system === undefined ? {} : { system }),
    messages: [{ role: "user", content: prompt }]
  });
  const block = response.content.find(
    (candidate): candidate is Extract<typeof candidate, { type: "text" }> => candidate.type === TEXT_BLOCK_TYPE
  );
  if (block === undefined) {
    throw new Error(`Model ${model} returned no text (stop_reason: ${response.stop_reason ?? "?"})`);
  }
  return block.text;
};

const summarizeCluster = async (cluster: ReportItem[]): Promise<string> => {
  const prompt = [
    "Summarize this cluster of related intel items as ONE tight paragraph for an internal digest.",
    "End the paragraph with the canonical source links in parentheses, primary link first.",
    "",
    ...R.map(clusterLine, cluster)
  ].join("\n");
  return askText(HAIKU_MODEL, SUMMARY_MAX_TOKENS, prompt);
};

const SYNTHESIS_SYSTEM =
  "You write Aggie, Spoke Phone's internal weekly intel digest. Spoke sells a cloud phone system " +
  "into regulated verticals; readers are sales, marketing, and leadership. Be factual and concise; " +
  "plain language; no hype. Preserve source links exactly as given.";

const synthesisPrompt = (vertical: Vertical, summaries: string[], previousBody: string): string =>
  [
    `Write this week's ${vertical} digest in markdown with exactly these sections:`,
    "## New this week — one paragraph per story cluster (use the cluster summaries below; keep their links).",
    "## Continuing stories — clusters that also appear in the previous digest; one sentence each on what changed. " +
      'Write "None." if there are none.',
    vertical === Vertical.Competitor
      ? "## Competitor sections — one subsection per competitor with announcements, complaints, and signals. " +
        'Frame partner-relationship items (Theta Lake, Smarsh) as opportunity, adding a "Where we fit" line ' +
        "when a coverage gap appears."
      : "",
    "Do not add any other sections (manual checks and footer are appended automatically).",
    "",
    "### Cluster summaries (this week)",
    ...R.map((summary: string) => `- ${summary}`, summaries),
    "",
    "### Previous digest",
    previousBody.length > 0 ? previousBody : "(none — this is the first digest)"
  ]
    .filter((line) => line.length > 0)
    .join("\n");

const latestReportBody = async (vertical: Vertical): Promise<string> => {
  const rows = await queryRows({
    namespace: TpufNamespace.Reports,
    filters: ["vertical", "Eq", vertical],
    topK: 1,
    includeAttributes: ["body", "report_date"],
    orderBy: ["report_date", "desc"]
  });
  const row = rows[0];
  return row === undefined ? "" : str(row, "body");
};

const upsertReport = async (vertical: Vertical, reportDate: string, body: string): Promise<void> => {
  const vectors = await embed([body], "document");
  const vector = vectors[0];
  if (vector === undefined) {
    throw new Error("Voyage returned no embedding for the report body");
  }
  await upsertRows(
    TpufNamespace.Reports,
    [{ id: `report:${vertical}:${reportDate}`, vector, vertical, report_date: reportDate, body }],
    { body: { type: "string", filterable: false } }
  );
};

type GeneratedReport = {
  body: string;
  clusters: number;
  items: number;
};

const generateDigestBody = async (vertical: Vertical): Promise<GeneratedReport> => {
  const items = await fetchWeekItems(vertical);
  if (items.length === 0) {
    return { body: "", clusters: 0, items: 0 };
  }
  const clusters = clusterItems(items);
  const summaries = await sequentially(clusters, summarizeCluster);
  const previousBody = await latestReportBody(vertical);
  const body = await askText(
    OPUS_MODEL,
    SYNTHESIS_MAX_TOKENS,
    synthesisPrompt(vertical, summaries, previousBody),
    SYNTHESIS_SYSTEM
  );
  return { body, clusters: clusters.length, items: items.length };
};

export { fetchWeekItems, generateDigestBody, latestReportBody, type ReportItem, upsertReport };
