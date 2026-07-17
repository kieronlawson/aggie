import { requireEnv } from "#src/config.ts";

const FIRECRAWL_API_BASE = "https://api.firecrawl.dev/v2";

type CreditUsageResponse = {
  success: boolean;
  data?: { remainingCredits?: number };
};

const remainingCredits = async (): Promise<number> => {
  const response = await fetch(`${FIRECRAWL_API_BASE}/team/credit-usage`, {
    headers: { Authorization: `Bearer ${requireEnv("FIRECRAWL_API_KEY")}` }
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
    headers: {
      Authorization: `Bearer ${requireEnv("FIRECRAWL_API_KEY")}`,
      "Content-Type": "application/json"
    },
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

export { FIRECRAWL_API_BASE, remainingCredits, scrapeRaw };
