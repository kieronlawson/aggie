import { Vertical } from "../config.js";
import { isoDate } from "../lib/time.js";

const MANUAL_CHECKS = [
  "*Manual checks* (not automated — terms of service):",
  "• G2 reviews: https://www.g2.com/categories/contact-center",
  "• Capterra reviews: https://www.capterra.com/contact-center-software/",
  "• LinkedIn: competitor company pages and exec posts"
].join("\n");

const footerSection = (quietSources: readonly string[], failedSources: readonly string[]): string => {
  const quiet = quietSources.length === 0 ? [] : [`• No items this week: ${quietSources.join(", ")}`];
  const failed = failedSources.length === 0 ? [] : [`• Failed this week: ${failedSources.join(", ")}`];
  const lines = [...failed, ...quiet];
  return ["*Source health*", ...(lines.length === 0 ? ["• All sources returned items this week"] : lines)].join("\n");
};

export type FormatInput = {
  vertical: Vertical;
  reportDate: number;
  body: string;
  quietSources: readonly string[];
  failedSources: readonly string[];
};

export const formatDigest = (input: FormatInput): string =>
  [
    `:newspaper: *Aggie weekly digest — ${input.vertical} — week ending ${isoDate(input.reportDate)}*`,
    input.body.trim(),
    MANUAL_CHECKS,
    footerSection(input.quietSources, input.failedSources)
  ].join("\n\n");
