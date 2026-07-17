import * as R from "ramda";

/** Static reminder list per the spec — these sources cannot be scraped. */
const MANUAL_CHECKS = [
  "G2 reviews: https://www.g2.com/products/ringcentral/reviews | https://www.g2.com/products/8x8/reviews",
  "Capterra: https://www.capterra.com/p/135003/RingCentral/ | https://www.capterra.com/p/121595/8x8/",
  "LinkedIn: competitor company pages and Spoke's ICP hashtags"
];

const appendStaticSections = (body: string, failedSources: string[]): string => {
  const failureLines =
    failedSources.length === 0
      ? ["No source failures this week."]
      : R.map((failure: string) => `- ${failure}`, failedSources);
  return [
    body.trim(),
    "",
    "## Manual checks",
    "",
    ...R.map((check: string) => `- ${check}`, MANUAL_CHECKS),
    "",
    "## Footer",
    "",
    ...failureLines
  ].join("\n");
};

export { appendStaticSections, MANUAL_CHECKS };
