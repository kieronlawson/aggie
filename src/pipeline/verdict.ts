import * as R from "ramda";

import { DedupeVerdict } from "#src/pipeline/types.ts";

const VALID_VERDICTS: string[] = Object.values(DedupeVerdict);

const extractJson = (text: string): string => {
  const match = /\{[^}]*\}/u.exec(text);
  return match === null ? "" : match[0];
};

const verdictOf = (json: string): string => {
  try {
    const parsed = JSON.parse(json) as { verdict?: unknown };
    return typeof parsed.verdict === "string" ? parsed.verdict : "";
  } catch {
    return "";
  }
};

/**
 * Parses the Haiku dedupe-arbitration response. Anything unparseable or
 * unrecognised falls back to `distinct`: the failure mode is a duplicate item
 * appearing twice, never a distinct story being silently merged away.
 */
const parseVerdict = (response: string): DedupeVerdict => {
  const verdict = verdictOf(extractJson(response));
  return R.includes(verdict, VALID_VERDICTS) ? (verdict as DedupeVerdict) : DedupeVerdict.Distinct;
};

export { parseVerdict };
