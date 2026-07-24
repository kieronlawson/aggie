import * as R from "ramda";

import { type SourceRecord } from "#src/registry/types.ts";

/** Static reminder list per the spec — these sources cannot be scraped. */
const MANUAL_CHECKS = [
  "G2 reviews: https://www.g2.com/products/ringcentral/reviews | https://www.g2.com/products/8x8/reviews",
  "Capterra: https://www.capterra.com/p/135003/RingCentral/ | https://www.capterra.com/p/121595/8x8/",
  "LinkedIn: competitor company pages and Spoke's ICP hashtags"
];

/** Active sources with zero items in the digest's fetched week (news + evergreen). */
const quietSources = (sources: SourceRecord[], itemSources: string[]): string[] => {
  const producing = new Set(itemSources);
  return R.pipe(
    R.filter((source: SourceRecord) => source.active && !producing.has(source.name)),
    R.map((source: SourceRecord) => source.name)
  )(sources);
};

const appendStaticSections = (body: string, failedSources: string[]): string => {
  const failureLines =
    failedSources.length === 0
      ? ["No source failures; every active source produced items this week."]
      : R.map((failure: string) => `- ${failure}`, failedSources);
  return [
    body.trim(),
    "",
    "## 🔎 Manual checks",
    "",
    ...R.map((check: string) => `- ${check}`, MANUAL_CHECKS),
    "",
    "## Footer",
    "",
    ...failureLines
  ].join("\n");
};

export { appendStaticSections, MANUAL_CHECKS, quietSources };
