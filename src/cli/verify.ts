import { checkAnthropicAuth } from "../clients/anthropic.js";
import { checkFirecrawlAuth } from "../clients/firecrawl.js";
import { checkSlackAuth, postMessage } from "../clients/slack.js";
import { listNamespaces, upsertRows } from "../clients/turbopuffer.js";
import { embedText } from "../clients/voyage.js";
import { ALL_NAMESPACES, EMBED_DIMS, stagingChannel } from "../config.js";
import { mapSeriesSettled } from "../lib/async.js";
import { mapSeries } from "../lib/async.js";

const initVector = (): number[] => [1, ...Array.from({ length: EMBED_DIMS - 1 }, () => 0)];

// Namespaces are created implicitly on first write; a marker row per
// namespace makes them exist up front (phase-0 task 3) and pins vector dims.
const ensureNamespaces = async (): Promise<string> => {
  await mapSeries(ALL_NAMESPACES, (namespace) =>
    upsertRows(namespace, [{ id: "namespace-init", vector: initVector(), record_type: "marker" }])
  );
  const existing = await listNamespaces();
  const missing = ALL_NAMESPACES.filter((namespace) => !existing.includes(namespace));
  if (missing.length > 0) {
    throw new Error(`Namespaces missing after init: ${missing.join(", ")}`);
  }
  return `${ALL_NAMESPACES.length} namespaces ready`;
};

const checkVoyage = async (): Promise<string> => {
  const embedding = await embedText("aggie verification ping");
  return `dims ${embedding.length}`;
};

type Check = { name: string; run: () => Promise<string> };

const CHECKS: readonly Check[] = [
  { name: "anthropic", run: checkAnthropicAuth },
  { name: "voyage", run: checkVoyage },
  { name: "turbopuffer", run: ensureNamespaces },
  { name: "firecrawl", run: checkFirecrawlAuth },
  { name: "slack", run: checkSlackAuth }
];

const main = async (): Promise<void> => {
  const results = await mapSeriesSettled(CHECKS, (check) => check.run());
  const lines = results.map((result) =>
    result.ok
      ? `:white_check_mark: ${result.input.name} — ${result.value}`
      : `:x: ${result.input.name} — ${result.error}`
  );
  const blockers = results.filter((result) => !result.ok);
  const header =
    blockers.length === 0
      ? ":rocket: aggie verify — all services reachable, namespaces created, deploy loop works"
      : `:warning: aggie verify — ${blockers.length} blocker(s)`;
  const text = [header, ...lines].join("\n");
  console.log(text);
  await postMessage(stagingChannel(), text);
  if (blockers.length > 0) {
    throw new Error(`Verification blockers: ${blockers.map((blocker) => blocker.input.name).join(", ")}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
