import { NAMESPACE_REPORTS, Vertical } from "../config.js";
import { scanRows, upsertRows } from "../clients/turbopuffer.js";
import { embedText } from "../clients/voyage.js";
import { isoDate } from "../lib/time.js";

export type PreviousReport = { reportDate: number; body: string };

const EMBED_INPUT_LIMIT = 20000;

export const fetchPreviousReport = async (vertical: Vertical): Promise<PreviousReport | undefined> => {
  const rows = await scanRows(NAMESPACE_REPORTS, ["vertical", "Eq", vertical]);
  const sorted = [...rows].sort((a, b) => Number(b.report_date ?? 0) - Number(a.report_date ?? 0));
  const [latest] = sorted;
  if (latest === undefined) {
    return undefined;
  }
  return { reportDate: Number(latest.report_date ?? 0), body: String(latest.body ?? "") };
};

export const upsertReport = async (
  vertical: Vertical,
  reportDate: number,
  body: string
): Promise<void> => {
  const vector = await embedText(body.slice(0, EMBED_INPUT_LIMIT));
  await upsertRows(NAMESPACE_REPORTS, [
    {
      id: `report-${vertical}-${isoDate(reportDate)}`,
      vector,
      vertical,
      report_date: reportDate,
      body
    }
  ]);
};
