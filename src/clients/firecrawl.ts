import { requireEnv } from "../config.js";
import { fetchJson } from "../lib/http.js";
import { sleep } from "../lib/async.js";

const BASE_URL = "https://api.firecrawl.dev/v1";
const POLL_INTERVAL_SECONDS = 10;
const MAX_POLLS = 90;
const STATUS_COMPLETED = "completed";
const STATUS_FAILED = "failed";

const authHeaders = (): Record<string, string> => ({
  authorization: `Bearer ${requireEnv("FIRECRAWL_API_KEY")}`
});

export enum ChangeStatus {
  New = "new",
  Same = "same",
  Changed = "changed",
  Removed = "removed"
}

export type ScrapedPage = {
  url: string;
  markdown: string;
  title: string;
  changeStatus: ChangeStatus;
  diff: string;
};

type FirecrawlDocument = {
  markdown?: string;
  metadata?: { url?: string; sourceURL?: string; title?: string };
  changeTracking?: { changeStatus?: string; diff?: { text?: string } };
};

type BatchStatus = { status?: string; data?: FirecrawlDocument[]; error?: string };

const pageUrl = (metadata: FirecrawlDocument["metadata"]): string => {
  const source = metadata?.sourceURL;
  const alt = metadata?.url;
  return source ?? alt ?? "";
};

const toPage = (doc: FirecrawlDocument): ScrapedPage => {
  const tracking = doc.changeTracking;
  const status = tracking?.changeStatus;
  return {
    url: pageUrl(doc.metadata),
    markdown: doc.markdown ?? "",
    title: doc.metadata?.title ?? "",
    changeStatus: (status ?? ChangeStatus.New) as ChangeStatus,
    diff: tracking?.diff?.text ?? ""
  };
};

export const startBatchScrape = async (urls: readonly string[]): Promise<string> => {
  const result = (await fetchJson(`${BASE_URL}/batch/scrape`, {
    method: "POST",
    headers: authHeaders(),
    body: {
      urls,
      formats: ["markdown", "changeTracking"],
      changeTrackingOptions: { modes: ["git-diff"] },
      onlyMainContent: true
    }
  })) as { id?: string; success?: boolean; error?: string };
  if (result.id === undefined) {
    throw new Error(`Firecrawl batch scrape did not return an id: ${result.error ?? "unknown"}`);
  }
  return result.id;
};

const fetchBatchStatus = async (id: string): Promise<BatchStatus> =>
  (await fetchJson(`${BASE_URL}/batch/scrape/${id}`, { headers: authHeaders() })) as BatchStatus;

const pollUntilDone = async (id: string, remaining: number): Promise<BatchStatus> => {
  const status = await fetchBatchStatus(id);
  if (status.status === STATUS_COMPLETED) {
    return status;
  }
  if (status.status === STATUS_FAILED) {
    throw new Error(`Firecrawl batch ${id} failed: ${status.error ?? "unknown"}`);
  }
  if (remaining <= 0) {
    throw new Error(`Firecrawl batch ${id} did not complete in time`);
  }
  await sleep(POLL_INTERVAL_SECONDS);
  return pollUntilDone(id, remaining - 1);
};

export const runBatchScrape = async (urls: readonly string[]): Promise<ScrapedPage[]> => {
  if (urls.length === 0) {
    return [];
  }
  const id = await startBatchScrape(urls);
  const status = await pollUntilDone(id, MAX_POLLS);
  return (status.data ?? []).map(toPage);
};

export const checkFirecrawlAuth = async (): Promise<string> => {
  const result = (await fetchJson(`${BASE_URL}/team/credit-usage`, {
    headers: authHeaders()
  })) as { data?: { remaining_credits?: number } };
  return `credits ${result.data?.remaining_credits ?? "unknown"}`;
};
