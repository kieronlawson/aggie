import { parseArgs } from "node:util";

import * as R from "ramda";

import { postMessage, SlackChannel } from "#src/clients/slack.ts";
import { patchRows, TpufNamespace, upsertRows } from "#src/clients/turbopuffer.ts";
import { renderSourcesMarkdown } from "#src/registry/export.ts";
import { loadCompetitors } from "#src/registry/read.ts";
import { competitorToRow, sourceId, sourceToRow, validateRegistry } from "#src/registry/records.ts";
import { SEED_COMPETITORS, SEED_NOTES, SEED_SOURCES } from "#src/registry/seed.ts";
import { type CompetitorRecord, Relationship, SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";

enum RegistryCommand {
  Seed = "seed",
  Export = "export",
  AddCompetitor = "add-competitor",
  AddSource = "add-source",
  SetSourceActive = "set-source-active"
}

type Flags = {
  command: string;
  name: string;
  relationship: string;
  aliases: string;
  kind: string;
  url: string;
  vertical: string;
  competitor: string;
  active: string;
};

const TRUE_FLAG = "true";

const parseFlags = (): Flags => {
  const { values } = parseArgs({
    options: {
      command: { type: "string" },
      name: { type: "string" },
      relationship: { type: "string" },
      aliases: { type: "string" },
      kind: { type: "string" },
      url: { type: "string" },
      vertical: { type: "string" },
      competitor: { type: "string" },
      active: { type: "string" }
    }
  });
  return {
    command: values.command ?? "",
    name: values.name ?? "",
    relationship: values.relationship ?? "",
    aliases: values.aliases ?? "",
    kind: values.kind ?? "",
    url: values.url ?? "",
    vertical: values.vertical ?? "",
    competitor: values.competitor ?? "",
    active: values.active ?? TRUE_FLAG
  };
};

const requireEnumValue = <T extends string>(label: string, value: string, allowed: readonly T[]): T => {
  if (!allowed.includes(value as T)) {
    throw new Error(`Invalid ${label} "${value}" — expected one of: ${allowed.join(", ")}`);
  }
  return value as T;
};

const announce = async (summary: string): Promise<void> => {
  console.log(summary);
  await postMessage(SlackChannel.IntelStaging, summary);
};

const seed = async (_flags: Flags): Promise<void> => {
  const errors = validateRegistry(SEED_COMPETITORS, SEED_SOURCES);
  if (errors.length > 0) {
    throw new Error(`Registry seed validation failed:\n${errors.join("\n")}`);
  }
  const rows = [...R.map(competitorToRow, SEED_COMPETITORS), ...R.map(sourceToRow, SEED_SOURCES)];
  await upsertRows(TpufNamespace.Registry, rows);
  await announce(
    `🌱 Registry seeded: ${String(SEED_COMPETITORS.length)} competitors, ` +
      `${String(SEED_SOURCES.length)} sources (${String(rows.length)} rows upserted).`
  );
};

const exportMarkdown = (_flags: Flags): Promise<void> => {
  console.log(renderSourcesMarkdown(SEED_COMPETITORS, SEED_SOURCES, SEED_NOTES));
  return Promise.resolve();
};

const addCompetitor = async (flags: Flags): Promise<void> => {
  const relationship = requireEnumValue<Relationship.Displace | Relationship.Partner>(
    "relationship",
    flags.relationship,
    [Relationship.Displace, Relationship.Partner]
  );
  if (flags.name.length === 0) {
    throw new Error("add-competitor requires --name");
  }
  const record: CompetitorRecord = {
    name: flags.name,
    relationship,
    aliases: R.reject((alias: string) => alias.length === 0, R.map(R.trim, flags.aliases.split(","))),
    active: flags.active === TRUE_FLAG
  };
  await upsertRows(TpufNamespace.Registry, [competitorToRow(record)]);
  await announce(`✏️ Registry: competitor "${record.name}" (${record.relationship}) upserted via W0.`);
};

const addSource = async (flags: Flags): Promise<void> => {
  const record: SourceRecord = {
    kind: requireEnumValue<SourceKind>("kind", flags.kind, Object.values(SourceKind)),
    url: flags.url,
    name: flags.name,
    vertical: requireEnumValue<Vertical>("vertical", flags.vertical, Object.values(Vertical)),
    competitor: flags.competitor,
    active: flags.active === TRUE_FLAG,
    added_at: new Date().toISOString()
  };
  if (record.name.length === 0) {
    throw new Error("add-source requires --name");
  }
  const competitors = await loadCompetitors();
  const errors = validateRegistry(competitors, [record]);
  if (errors.length > 0) {
    throw new Error(`add-source validation failed:\n${errors.join("\n")}`);
  }
  await upsertRows(TpufNamespace.Registry, [sourceToRow(record)]);
  await announce(`✏️ Registry: source "${record.name}" (${record.kind}, ${record.vertical}) upserted via W0.`);
};

const setSourceActive = async (flags: Flags): Promise<void> => {
  if (flags.url.length === 0) {
    throw new Error("set-source-active requires --url");
  }
  const active = flags.active === TRUE_FLAG;
  await patchRows(TpufNamespace.Registry, [{ id: sourceId(flags.url), active }]);
  await announce(`✏️ Registry: source ${flags.url} active=${String(active)} via W0.`);
};

const COMMAND_HANDLERS: Record<string, (flags: Flags) => Promise<void>> = {
  [RegistryCommand.Seed]: seed,
  [RegistryCommand.Export]: exportMarkdown,
  [RegistryCommand.AddCompetitor]: addCompetitor,
  [RegistryCommand.AddSource]: addSource,
  [RegistryCommand.SetSourceActive]: setSourceActive
};

const reportFailure = async (error: unknown): Promise<void> => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`aggie registry failed: ${detail}`);
  process.exitCode = 1;
  await postMessage(SlackChannel.IntelStaging, `❌ aggie registry failed: ${detail}`).catch(() => undefined);
};

const main = async (): Promise<void> => {
  const flags = parseFlags();
  const handler = COMMAND_HANDLERS[flags.command];
  if (handler === undefined) {
    throw new Error(`Unknown registry command: "${flags.command}"`);
  }
  await handler(flags);
};

await main().catch(reportFailure);
