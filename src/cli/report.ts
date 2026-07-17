import { parseArgs } from "node:util";

import { postMessage, postThreadReply, SlackChannel } from "#src/clients/slack.ts";
import { queryRows, TpufNamespace } from "#src/clients/turbopuffer.ts";
import { sequentially } from "#src/lib/async.ts";
import { Vertical } from "#src/registry/types.ts";
import { appendStaticSections } from "#src/report/format.ts";
import { generateDigestBody, upsertReport } from "#src/report/generate.ts";
import { chunkForSlack, toMrkdwn } from "#src/report/mrkdwn.ts";

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

const alreadyDelivered = async (vertical: Vertical, reportDate: string): Promise<boolean> => {
  const rows = await queryRows({
    namespace: TpufNamespace.Reports,
    filters: ["id", "Eq", `report:${vertical}:${reportDate}`],
    topK: 1,
    includeAttributes: ["report_date"]
  });
  return rows.length > 0;
};

const deliverToSlack = async (header: string, digest: string): Promise<void> => {
  const chunks = chunkForSlack(toMrkdwn(digest));
  const threadTs = await postMessage(SlackChannel.IntelStaging, header);
  await sequentially(chunks, async (chunk) => {
    await postThreadReply(SlackChannel.IntelStaging, threadTs, chunk);
  });
};

const main = async (): Promise<void> => {
  const { values } = parseArgs({ options: { vertical: { type: "string" } } });
  const vertical = parseVertical(values.vertical ?? "");
  const reportDate = new Date().toISOString().slice(0, DATE_LENGTH);
  if (await alreadyDelivered(vertical, reportDate)) {
    console.log(`Digest for ${vertical} on ${reportDate} already delivered — skipping (idempotent re-run).`);
    return;
  }
  const generated = await generateDigestBody(vertical);
  if (generated.items === 0) {
    const note = `📭 Aggie ${vertical} digest: no items in the trailing 7 days — nothing to report.`;
    console.log(note);
    await postMessage(SlackChannel.IntelStaging, note);
    return;
  }
  const digest = appendStaticSections(generated.body, []);
  const header =
    `📰 *Aggie weekly digest — ${vertical} — ${reportDate}* ` +
    `(${String(generated.items)} items in ${String(generated.clusters)} clusters) — digest in thread 🧵`;
  await deliverToSlack(header, digest);
  await upsertReport(vertical, reportDate, digest);
  console.log(`Digest for ${vertical} posted to #intel-staging (threaded) and upserted (${reportDate}).`);
};

await main().catch(async (error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`aggie report failed: ${detail}`);
  process.exitCode = 1;
  await postMessage(SlackChannel.IntelStaging, `❌ aggie report failed: ${detail}`).catch(() => undefined);
});
