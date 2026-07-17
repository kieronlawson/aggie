import { parseArgs } from "node:util";

import { postMessage, SlackChannel } from "#src/clients/slack.ts";
import { Vertical } from "#src/registry/types.ts";
import { appendStaticSections } from "#src/report/format.ts";
import { generateDigestBody, upsertReport } from "#src/report/generate.ts";

const VERTICALS: string[] = Object.values(Vertical);
const DATE_LENGTH = 10;

const parseVertical = (value: string): Vertical => {
  if (value.length === 0) {
    return Vertical.Finance;
  }
  if (!VERTICALS.includes(value)) {
    throw new Error(`Unknown vertical "${value}" — expected one of: ${VERTICALS.join(", ")}`);
  }
  return value as Vertical;
};

const main = async (): Promise<void> => {
  const { values } = parseArgs({ options: { vertical: { type: "string" } } });
  const vertical = parseVertical(values.vertical ?? "");
  const generated = await generateDigestBody(vertical);
  if (generated.items === 0) {
    const note = `📭 Aggie ${vertical} digest: no items in the trailing 7 days — nothing to report.`;
    console.log(note);
    await postMessage(SlackChannel.IntelStaging, note);
    return;
  }
  const reportDate = new Date().toISOString().slice(0, DATE_LENGTH);
  const digest = appendStaticSections(generated.body, []);
  const header =
    `📰 *Aggie weekly digest — ${vertical} — ${reportDate}* ` +
    `(${String(generated.items)} items in ${String(generated.clusters)} clusters)\n\n`;
  await postMessage(SlackChannel.IntelStaging, `${header}${digest}`);
  await upsertReport(vertical, reportDate, digest);
  console.log(`Digest for ${vertical} posted to #intel-staging and upserted (${reportDate}).`);
};

await main().catch(async (error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`aggie report failed: ${detail}`);
  process.exitCode = 1;
  await postMessage(SlackChannel.IntelStaging, `❌ aggie report failed: ${detail}`).catch(() => undefined);
});
