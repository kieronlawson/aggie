import { generateText } from "../clients/anthropic.js";
import { SYNTH_MODEL, Vertical } from "../config.js";
import type { ClusterSummary } from "./summarize.js";

const PREVIOUS_REPORT_LIMIT = 15000;

const SYNTH_SYSTEM = [
  "You are the editor of Aggie, an internal weekly intelligence digest for Spoke Phone (cloud",
  "telephony with compliance focus). You receive per-cluster summaries for the trailing 7 days and",
  "the previous week's report. Produce the digest body in Slack mrkdwn (use *bold* for section",
  "headers and story leads, • for bullets, and <url|title> for links — never # headers or [](),",
  "and keep every link that is given to you, canonical URL first).",
  "Structure:",
  "1. *New this week* — one paragraph per cluster that was NOT in the previous report, links after",
  "each paragraph.",
  "2. *Continuing stories* — clusters that also appeared in the previous report: one sentence each",
  "on what changed this week. Omit the section if there are none.",
  "3. For the competitor digest only: group into per-competitor sections (announcements,",
  "complaints, signals). Frame partner-relationship items as opportunity, not threat, and add a",
  "'where we fit' line when a coverage gap appears.",
  "Do not invent items, do not add a footer or manual-check section (they are appended for you),",
  "and do not editorialise beyond commercial/compliance relevance."
].join(" ");

const clusterBlock = (summary: ClusterSummary, index: number): string =>
  [
    `Cluster ${index + 1} (classifications: ${[...new Set(summary.items.map((item) => item.classification))].join(", ")}${
      summary.items[0]?.competitor ? `; competitor: ${summary.items[0].competitor}` : ""
    })`,
    summary.paragraph,
    `Links: ${summary.links.join(" ")}`
  ].join("\n");

export const synthesizeReport = async (
  vertical: Vertical,
  summaries: readonly ClusterSummary[],
  previousBody: string
): Promise<string> => {
  const user = [
    `Vertical: ${vertical}`,
    "",
    "This week's clusters:",
    ...summaries.map(clusterBlock),
    "",
    "Previous week's report (for the Continuing stories section; empty if none):",
    previousBody.slice(0, PREVIOUS_REPORT_LIMIT)
  ].join("\n\n");
  return generateText({ model: SYNTH_MODEL, system: SYNTH_SYSTEM, user });
};
