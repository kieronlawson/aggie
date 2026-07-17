import { parseArgs } from "node:util";

import * as R from "ramda";

import { postMessage, SlackChannel } from "#src/clients/slack.ts";
import { TpufNamespace, upsertRows } from "#src/clients/turbopuffer.ts";
import { renderSourcesMarkdown } from "#src/registry/export.ts";
import { competitorToRow, sourceToRow, validateRegistry } from "#src/registry/records.ts";
import { SEED_COMPETITORS, SEED_NOTES, SEED_SOURCES } from "#src/registry/seed.ts";

enum RegistryCommand {
  Seed = "seed",
  Export = "export"
}

const seed = async (): Promise<void> => {
  const errors = validateRegistry(SEED_COMPETITORS, SEED_SOURCES);
  if (errors.length > 0) {
    throw new Error(`Registry seed validation failed:\n${errors.join("\n")}`);
  }
  const rows = [...R.map(competitorToRow, SEED_COMPETITORS), ...R.map(sourceToRow, SEED_SOURCES)];
  await upsertRows(TpufNamespace.Registry, rows);
  const summary =
    `Registry seeded: ${String(SEED_COMPETITORS.length)} competitors, ` +
    `${String(SEED_SOURCES.length)} sources (${String(rows.length)} rows upserted).`;
  console.log(summary);
  await postMessage(SlackChannel.IntelStaging, `🌱 ${summary}`);
};

const exportMarkdown = (): Promise<void> => {
  console.log(renderSourcesMarkdown(SEED_COMPETITORS, SEED_SOURCES, SEED_NOTES));
  return Promise.resolve();
};

const runCommand = R.cond<[string], Promise<void>>([
  [(command): boolean => command === (RegistryCommand.Seed as string), seed],
  [(command): boolean => command === (RegistryCommand.Export as string), exportMarkdown],
  [R.T, (command): Promise<void> => Promise.reject(new Error(`Unknown registry command: ${command}`))]
]);

const reportFailure = async (error: unknown): Promise<void> => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`aggie registry failed: ${detail}`);
  process.exitCode = 1;
  await postMessage(SlackChannel.IntelStaging, `❌ aggie registry failed: ${detail}`).catch(() => undefined);
};

const main = async (): Promise<void> => {
  const { values } = parseArgs({ options: { command: { type: "string" } } });
  const command = values.command ?? "";
  await runCommand(command).catch(reportFailure);
};

await main();
