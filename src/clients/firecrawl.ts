import { requireEnv } from "#src/config.ts";

const FIRECRAWL_API_BASE = "https://api.firecrawl.dev/v2";

type CreditUsageResponse = {
  success: boolean;
  data?: { remainingCredits?: number };
};

const authHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${requireEnv("FIRECRAWL_API_KEY")}`,
  "Content-Type": "application/json"
});

const remainingCredits = async (): Promise<number> => {
  const response = await fetch(`${FIRECRAWL_API_BASE}/team/credit-usage`, {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw new Error(`Firecrawl credit-usage request failed: HTTP ${String(response.status)} ${await response.text()}`);
  }
  const payload = (await response.json()) as CreditUsageResponse;
  return payload.data?.remainingCredits ?? 0;
};

type ScrapeResponse = {
  success: boolean;
  data?: { rawHtml?: string | null };
};

/** Fetches a URL's raw body through Firecrawl — used for hosts that block datacenter IPs. */
const scrapeRaw = async (url: string): Promise<string> => {
  const response = await fetch(`${FIRECRAWL_API_BASE}/scrape`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ url, formats: ["rawHtml"], proxy: "auto" })
  });
  if (!response.ok) {
    throw new Error(`Firecrawl scrape failed for ${url}: HTTP ${String(response.status)} ${await response.text()}`);
  }
  const payload = (await response.json()) as ScrapeResponse;
  const raw = payload.data?.rawHtml ?? "";
  if (raw.length === 0) {
    throw new Error(`Firecrawl scrape returned empty rawHtml for ${url}`);
  }
  return raw;
};

enum ChangeStatus {
  New = "new",
  Same = "same",
  Changed = "changed",
  Removed = "removed"
}

const CHANGE_STATUSES: string[] = Object.values(ChangeStatus);

type CrawlPageResult = {
  url: string;
  title: string;
  markdown: string;
  changeStatus: ChangeStatus;
  diffText: string;
};

type BatchPageData = {
  markdown?: string;
  metadata?: { sourceURL?: string; title?: string };
  changeTracking?: { changeStatus?: string; diff?: { text?: string } | null };
};

type BatchStatusPayload = {
  status?: string;
  next?: string | null;
  data?: BatchPageData[];
};

type BatchResults = {
  status: string;
  pages: CrawlPageResult[];
};

const BATCH_STATUS_COMPLETED = "completed";
const BATCH_STATUS_FAILED = "failed";

const requireJobId = (payload: { id?: string }): string => {
  const id = payload.id ?? "";
  if (id.length === 0) {
    throw new Error("Firecrawl batch start returned no job id");
  }
  return id;
};

const startChangeTrackingBatch = async (urls: string[]): Promise<string> => {
  const response = await fetch(`${FIRECRAWL_API_BASE}/batch/scrape`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      urls,
      formats: ["markdown", { type: "changeTracking", modes: ["git-diff"] }],
      proxy: "auto"
    })
  });
  if (!response.ok) {
    throw new Error(`Firecrawl batch start failed: HTTP ${String(response.status)} ${await response.text()}`);
  }
  return requireJobId((await response.json()) as { id?: string });
};

const getChangeStatus = (status: string): ChangeStatus =>
  CHANGE_STATUSES.includes(status) ? (status as ChangeStatus) : ChangeStatus.Same;

const toPageResult = (entry: BatchPageData): CrawlPageResult => {
  const metadata = entry.metadata ?? {};
  const diffText = entry.changeTracking?.diff?.text ?? "";
  const changeStatus = getChangeStatus(entry.changeTracking?.changeStatus ?? "");
  return {
    url: metadata.sourceURL ?? "",
    title: metadata.title ?? "",
    markdown: entry.markdown ?? "",
    changeStatus,
    diffText
  };
};

const fetchBatchPage = async (url: string): Promise<BatchStatusPayload> => {
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(`Firecrawl batch status failed: HTTP ${String(response.status)} ${await response.text()}`);
  }
  return (await response.json()) as BatchStatusPayload;
};

const followNext = async (next: string | null, acc: BatchPageData[]): Promise<BatchPageData[]> => {
  if (next === null || next.length === 0) {
    return acc;
  }
  const page = await fetchBatchPage(next);
  return followNext(page.next ?? null, [...acc, ...(page.data ?? [])]);
};

/** An in-progress job keeps returning next cursors forever — only paginate once completed. */
const getBatchResults = async (jobId: string): Promise<BatchResults> => {
  const first = await fetchBatchPage(`${FIRECRAWL_API_BASE}/batch/scrape/${jobId}`);
  const status = first.status ?? "";
  if (status !== BATCH_STATUS_COMPLETED) {
    return { status, pages: [] };
  }
  const rest = await followNext(first.next ?? null, []);
  const entries = [...(first.data ?? []), ...rest];
  return { status, pages: entries.map(toPageResult) };
};

export {
  BATCH_STATUS_COMPLETED,
  BATCH_STATUS_FAILED,
  type BatchResults,
  ChangeStatus,
  type CrawlPageResult,
  FIRECRAWL_API_BASE,
  getBatchResults,
  remainingCredits,
  scrapeRaw,
  startChangeTrackingBatch
};
