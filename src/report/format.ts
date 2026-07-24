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

type DigestCounts = {
  items: number;
  clusters: number;
};

/** Card header; counts are absent on stored digests written before counts were recorded. */
const digestHeader = (vertical: string, reportDate: string, counts?: DigestCounts): string => {
  const base = `📡 *Aggie · ${vertical} · week of ${reportDate}*`;
  return counts === undefined
    ? base
    : `${base} — ${String(counts.items)} items · ${String(counts.clusters)} stories`;
};

/** Marker heading separating the channel card from the thread body. */
const DETAILS_HEADING = "## Details";

type SplitDigest = {
  card: string;
  thread: string;
};

/** Cuts the digest at DETAILS_HEADING; a missing marker degrades to card-less delivery. */
const splitDigest = (body: string): SplitDigest => {
  const markerIndex = body.indexOf(DETAILS_HEADING);
  if (markerIndex === -1) {
    return { card: "", thread: body.trim() };
  }
  return { card: body.slice(0, markerIndex).trim(), thread: body.slice(markerIndex).trim() };
};

export {
  appendStaticSections,
  DETAILS_HEADING,
  type DigestCounts,
  digestHeader,
  MANUAL_CHECKS,
  quietSources,
  type SplitDigest,
  splitDigest
};
