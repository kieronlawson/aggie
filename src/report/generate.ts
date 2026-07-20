import * as R from "ramda";

import { createAnthropic, HAIKU_MODEL, OPUS_MODEL, TEXT_BLOCK_TYPE } from "#src/clients/anthropic.ts";
import { queryRows, TpufNamespace, type TpufResultRow, upsertRows } from "#src/clients/turbopuffer.ts";
import { embed } from "#src/clients/voyage.ts";
import { sequentially } from "#src/lib/async.ts";
import { itemsNamespaceFor } from "#src/pipeline/process.ts";
import { ContentKind } from "#src/pipeline/types.ts";
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
  content_kind: string;
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
  "merged_urls",
  "content_kind"
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
  merged_urls: Array.isArray(row["merged_urls"]) ? (row["merged_urls"] as string[]) : [],
  content_kind: str(row, "content_kind")
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

const clusterSummaryPrompt = (cluster: ReportItem[]): string =>
  [
    "Summarize this cluster of related intel items as ONE tight paragraph for an internal digest.",
    "End the paragraph with the canonical source links in parentheses, primary link first, each",
    "written as a markdown link [publisher name](url) — e.g. [FINRA.org](https://www.finra.org/...)",
    "— never a bare URL.",
    "",
    ...R.map(clusterLine, cluster)
  ].join("\n");

const summarizeCluster = async (cluster: ReportItem[]): Promise<string> =>
  askText(HAIKU_MODEL, SUMMARY_MAX_TOKENS, clusterSummaryPrompt(cluster));

const isEvergreen = (item: ReportItem): boolean =>
  item.content_kind === (ContentKind.Evergreen as string);

const WORTH_A_READ_HEADING = "## 📚 Worth a read";

const worthAReadSection = (items: ReportItem[]): string =>
  items.length === 0
    ? ""
    : [
      WORTH_A_READ_HEADING,
      "",
      ...R.map((item: ReportItem) => `- [${item.title}](${item.url}) — ${item.summary}`, items)
    ].join("\n");

const SYNTHESIS_SYSTEM = [
  "You write Aggie, Spoke Phone's internal weekly intel digest. Spoke sells a cloud phone system",
  "with compliance call recording into regulated verticals (finance, insurance, healthcare).",
  "",
  "Readers and how each uses intel:",
  "- Sales: talking points for deals in regulated verticals (enforcement actions, recordkeeping rules).",
  "- Marketing: content angles from regulatory changes or competitor gaps.",
  "- Product: roadmap and compliance signals worth building toward.",
  "- Leadership: competitive posture and market shifts.",
  "",
  "Partner-relationship items (Theta Lake, Smarsh) are opportunity, not threat.",
  "",
  "Aggie's voice: a sharp, well-read intel analyst who respects the reader's time — confident,",
  "warm, occasionally wry. The lead-in should hook; signals stay punchy; Details paragraphs stay",
  "plain and factual. Personality never bends facts: no invented details, no product hype, and",
  "every link is preserved exactly as given, always as a markdown link [text](url), never a bare URL."
].join("\n");

const synthesisPrompt = (vertical: Vertical, summaries: string[], previousBody: string): string =>
  [
    `Write this week's ${vertical} digest in markdown with exactly these parts, in order:`,
    "Lead-in — 1-2 sentences at the very top, no heading, in Aggie's voice: the week's sharpest " +
      "takeaway as a hook that makes the reader want the rest.",
    "## ⚡ Signals — the 2-3 most actionable stories, one bullet each formatted " +
      "\"<emoji> **<Role>:** <situation> → <what to do about it>\" ending with the story link. " +
      "Roles and emoji: 💼 Sales, 📣 Marketing, 🛠️ Product, 👔 Leadership. One line per bullet. " +
      'Write "Nothing requiring action this week." if no story is genuinely actionable.',
    "## 🆕 New this week — one bullet per new story cluster: \"**<short title>** — <one-line gist>\" " +
      "ending with the story link. One line each; the full paragraphs belong in Details.",
    "## Details — one paragraph per story cluster (use the cluster summaries below; keep their links). " +
      "When a story has a concrete use for a team, end its paragraph with an italic line " +
      "\"_Why it matters — **<Role>:** <one sentence>_\" (multiple role tags allowed). Omit the line for " +
      "marginal stories — never write filler.",
    "## 🔁 Continuing stories — ONLY clusters that also appear in the previous digest AND have something " +
      "new; one sentence each on what changed. If continuing stories exist but none changed, write a " +
      "single line: \"<N> continuing stories, no changes — <title> · <title> · …\". " +
      'Write "None." if there are no continuing stories.',
    vertical === Vertical.Competitor
      ? "## Competitor sections — one subsection per competitor with announcements, complaints, and signals. " +
        'Frame partner-relationship items (Theta Lake, Smarsh) as opportunity, adding a "Where we fit" line ' +
        "when a coverage gap appears."
      : "",
    "Every link in your output must be a markdown link [text](url) — never a bare URL. " +
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
  const [evergreen, news] = R.partition(isEvergreen, items);
  const reading = worthAReadSection(evergreen);
  if (news.length === 0) {
    return { body: reading, clusters: 0, items: items.length };
  }
  const clusters = clusterItems(news);
  const summaries = await sequentially(clusters, summarizeCluster);
  const previousBody = await latestReportBody(vertical);
  const synthesized = await askText(
    OPUS_MODEL,
    SYNTHESIS_MAX_TOKENS,
    synthesisPrompt(vertical, summaries, previousBody),
    SYNTHESIS_SYSTEM
  );
  const body = [synthesized, reading].filter((part) => part.length > 0).join("\n\n");
  return { body, clusters: clusters.length, items: items.length };
};

export {
  clusterSummaryPrompt,
  fetchWeekItems,
  generateDigestBody,
  isEvergreen,
  latestReportBody,
  type ReportItem,
  SYNTHESIS_SYSTEM,
  synthesisPrompt,
  upsertReport,
  worthAReadSection
};
