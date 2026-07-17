import { Cadence, Relationship, SourceKind, Vertical, env, requireEnv, stagingChannel } from "../config.js";
import { postMessage } from "../clients/slack.js";
import { exportMarkdown } from "../registry/exportMd.js";
import { seedCompetitors, seedSources } from "../registry/seed.js";
import {
  competitorNameExists,
  listCompetitors,
  listSources,
  newCompetitor,
  newSource,
  sourceId,
  upsertCompetitors,
  upsertSources
} from "../registry/store.js";

const ACTION_ADD_COMPETITOR = "add_competitor";
const ACTION_ADD_SOURCE = "add_source";
const ACTION_DISABLE_SOURCE = "disable_source";
const ACTION_SEED = "seed";
const ACTION_EXPORT = "export";

const splitAliases = (raw: string): string[] =>
  raw
    .split(",")
    .map((alias) => alias.trim())
    .filter((alias) => alias !== "");

const addCompetitor = async (): Promise<string> => {
  const name = requireEnv("INPUT_NAME");
  const relationship = requireEnv("INPUT_RELATIONSHIP") as Relationship;
  const aliases = splitAliases(env("INPUT_ALIASES", ""));
  const competitor = newCompetitor(name, relationship, aliases);
  await upsertCompetitors([competitor]);
  return `Added competitor ${competitor.name} (${competitor.relationship})`;
};

// A source naming a competitor is validated against the registry so a typo
// cannot silently create a new competitor (spec W0).
const addSource = async (): Promise<string> => {
  const competitorName = env("INPUT_COMPETITOR", "");
  if (competitorName !== "") {
    const competitors = await listCompetitors();
    if (!competitorNameExists(competitors, competitorName)) {
      throw new Error(`Unknown competitor "${competitorName}" — add it first with add_competitor`);
    }
  }
  const source = newSource({
    kind: requireEnv("INPUT_KIND") as SourceKind,
    url: requireEnv("INPUT_URL"),
    vertical: requireEnv("INPUT_VERTICAL") as Vertical,
    competitor: competitorName,
    cadence: env("INPUT_CADENCE", Cadence.Daily) as Cadence
  });
  await upsertSources([source]);
  return `Added ${source.kind} source ${source.url} (${source.vertical})`;
};

const disableSource = async (): Promise<string> => {
  const url = requireEnv("INPUT_URL");
  const sources = await listSources();
  const target = sources.find((source) => source.id === sourceId(url));
  if (target === undefined) {
    throw new Error(`No source found for URL ${url}`);
  }
  await upsertSources([{ ...target, active: false }]);
  return `Disabled source ${url}`;
};

const seed = async (): Promise<string> => {
  await upsertCompetitors(seedCompetitors());
  await upsertSources(seedSources());
  return `Seeded ${seedCompetitors().length} competitors and ${seedSources().length} sources`;
};

const runExport = async (): Promise<string> => {
  const competitors = await listCompetitors();
  const sources = await listSources();
  const markdown = exportMarkdown(competitors, sources);
  console.log(markdown);
  return `Registry export: ${competitors.length} competitors, ${sources.length} sources (markdown in run log — paste into docs/sources-v1.md)`;
};

const ACTIONS: Record<string, () => Promise<string>> = {
  [ACTION_ADD_COMPETITOR]: addCompetitor,
  [ACTION_ADD_SOURCE]: addSource,
  [ACTION_DISABLE_SOURCE]: disableSource,
  [ACTION_SEED]: seed,
  [ACTION_EXPORT]: runExport
};

const main = async (): Promise<void> => {
  const action = requireEnv("INPUT_ACTION");
  const handler = ACTIONS[action];
  if (handler === undefined) {
    throw new Error(`Unknown registry action: ${action}`);
  }
  const message = await handler();
  console.log(message);
  await postMessage(stagingChannel(), `:card_index: *aggie w0-registry* — ${message}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
