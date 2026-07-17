import { postMessage } from "../clients/slack.js";
import { stagingChannel } from "../config.js";

const MAX_FAILURE_LINES = 20;

export type RunFailure = { label: string; error: string };

export const postRunSummary = async (workflow: string, lines: readonly string[]): Promise<void> => {
  const text = [`*aggie ${workflow}*`, ...lines].join("\n");
  await postMessage(stagingChannel(), text);
};

// Every entrypoint posts its own failures to Slack with context (spec:
// failures are read in the channel, not in Actions logs).
export const postFailures = async (workflow: string, failures: readonly RunFailure[]): Promise<void> => {
  if (failures.length === 0) {
    return;
  }
  const lines = failures
    .slice(0, MAX_FAILURE_LINES)
    .map((failure) => `• ${failure.label}: ${failure.error}`);
  const overflow = failures.length > MAX_FAILURE_LINES ? [`… and ${failures.length - MAX_FAILURE_LINES} more`] : [];
  await postMessage(stagingChannel(), [`:x: *aggie ${workflow} failures*`, ...lines, ...overflow].join("\n"));
};
