/**
 * One-off recovery (2026-07-24): the competitor digest force re-run regenerated
 * content and overwrote the stored report row, losing the original. Deleting
 * the row lets the next report run regenerate a full digest against the
 * previous week's baseline. Delete this file (and its workflow) after the run.
 */
import { postMessage, SlackChannel } from "#src/clients/slack.ts";
import { createTurbopuffer, TpufNamespace } from "#src/clients/turbopuffer.ts";

const REPORT_ID = "report:competitor:2026-07-24";

const main = async (): Promise<void> => {
  await createTurbopuffer().namespace(TpufNamespace.Reports).write({ deletes: [REPORT_ID] });
  console.log(`Deleted ${REPORT_ID} from the ${TpufNamespace.Reports} namespace.`);
};

await main().catch(async (error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`aggie reset-competitor-report failed: ${detail}`);
  process.exitCode = 1;
  await postMessage(SlackChannel.IntelStaging, `❌ aggie reset-competitor-report failed: ${detail}`).catch(
    () => undefined
  );
});
