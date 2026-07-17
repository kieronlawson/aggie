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

export { FIRECRAWL_API_BASE, remainingCredits };
