import * as R from "ramda";

import { HAIKU_MODEL, OPUS_MODEL, pingModel } from "#src/clients/anthropic.ts";
import { remainingCredits } from "#src/clients/firecrawl.ts";
import { authTest, postMessage, SlackChannel } from "#src/clients/slack.ts";
import { ALL_NAMESPACES, listNamespaces, upsertRows } from "#src/clients/turbopuffer.ts";
import { embed, EMBEDDING_MODEL } from "#src/clients/voyage.ts";

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const BOOTSTRAP_ROW_ID = "_bootstrap";

const check = async (name: string, run: () => Promise<string>): Promise<CheckResult> => {
  try {
    const detail = await run();
    return { name, ok: true, detail };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { name, ok: false, detail };
  }
};

const checkVoyage = async (): Promise<string> => {
  const vectors = await embed(["aggie verify ping"], "document");
  const dims = vectors[0]?.length ?? 0;
  if (dims === 0) {
    throw new Error("Voyage returned no embedding");
  }
  return `${EMBEDDING_MODEL}, ${String(dims)} dims`;
};

const bootstrapNamespaces = async (): Promise<string> => {
  const vectors = await embed(["aggie namespace bootstrap marker"], "document");
  const vector = vectors[0];
  if (vector === undefined) {
    throw new Error("Voyage returned no embedding for the bootstrap marker");
  }
  await Promise.all(
    R.map(
      (namespace) => upsertRows(namespace, [{ id: BOOTSTRAP_ROW_ID, vector, kind: "bootstrap" }]),
      ALL_NAMESPACES
    )
  );
  const namespaces = await listNamespaces();
  const missing = R.difference(R.map(String, ALL_NAMESPACES), namespaces);
  if (missing.length > 0) {
    throw new Error(`Namespaces missing after bootstrap: ${missing.join(", ")}`);
  }
  return `${String(ALL_NAMESPACES.length)} namespaces present`;
};

const formatResult = (result: CheckResult): string => {
  const mark = result.ok ? "✅" : "❌";
  return `${mark} ${result.name}: ${result.detail}`;
};

const runChecks = async (): Promise<CheckResult[]> =>
  Promise.all([
    check("anthropic (haiku)", () => pingModel(HAIKU_MODEL)),
    check("anthropic (opus)", () => pingModel(OPUS_MODEL)),
    check("voyage", checkVoyage),
    check("turbopuffer", bootstrapNamespaces),
    check("firecrawl", async (): Promise<string> => `${String(await remainingCredits())} credits remaining`),
    check("slack", authTest)
  ]);

const main = async (): Promise<void> => {
  const results = await runChecks();
  const passed = R.filter((result: CheckResult) => result.ok, results).length;
  const summary = [
    `Aggie phase 0 verify: ${String(passed)}/${String(results.length)} checks passed`,
    ...R.map(formatResult, results)
  ].join("\n");
  console.log(summary);
  const slackResult = await check("slack post", async (): Promise<string> => {
    await postMessage(SlackChannel.IntelStaging, summary);
    return "posted to #intel-staging";
  });
  console.log(formatResult(slackResult));
  const allOk = passed === results.length && slackResult.ok;
  process.exitCode = allOk ? 0 : 1;
};

await main();
