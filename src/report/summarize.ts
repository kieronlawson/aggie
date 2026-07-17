import { structuredJson } from "../clients/anthropic.js";
import { CLASSIFY_MODEL } from "../config.js";
import type { StoredItem } from "../pipeline/types.js";
import type { Cluster } from "./cluster.js";

export type ClusterSummary = {
  key: string;
  paragraph: string;
  items: StoredItem[];
  links: string[];
};

const SUMMARY_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    paragraph: {
      type: "string",
      description: "One tight paragraph summarising the story for a sales/leadership audience"
    }
  },
  required: ["paragraph"],
  additionalProperties: false
};

const SUMMARY_SYSTEM = [
  "You write one paragraph per news cluster for an internal weekly intelligence digest.",
  "Audience: sales, marketing and leadership at a cloud telephony company selling compliant",
  "communications. Be concrete: who did what, when, and why it matters commercially or for",
  "compliance. No preamble, no bullet points, 2-4 sentences."
].join(" ");

const itemLine = (item: StoredItem): string =>
  `- [${item.classification}] ${item.title}: ${item.summary}`;

// Canonical URL first; reprints are already folded into merged_urls.
export const clusterLinks = (cluster: Cluster): string[] => {
  const urls = cluster.items.flatMap((item) => [item.url, ...item.merged_urls]);
  return [...new Set(urls)];
};

export const summarizeCluster = async (cluster: Cluster): Promise<ClusterSummary> => {
  const user = ["Items in this cluster:", ...cluster.items.map(itemLine)].join("\n");
  const raw = (await structuredJson({
    model: CLASSIFY_MODEL,
    system: SUMMARY_SYSTEM,
    user,
    schema: SUMMARY_SCHEMA
  })) as { paragraph?: string };
  return {
    key: cluster.key,
    paragraph: raw.paragraph ?? "",
    items: cluster.items,
    links: clusterLinks(cluster)
  };
};
