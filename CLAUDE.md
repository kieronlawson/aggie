# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Aggie is an internal intel aggregator for Spoke: it collects regulatory news and competitor
intelligence, then delivers weekly Slack/email digests per vertical plus immediate alerts for
complaints and outages. It is being built autonomously by Claude, phase by phase, with Kieron
reviewing at phase gates.

**The repo currently contains only documentation — no code yet.** The source of truth is:

- `docs/2026-07-17-intel-aggregator-spec.md` — approved spec: architecture, data model,
  classification schema, report format, resolved decisions.
- `docs/2026-07-17-intel-aggregator-implementation-plan.md` — build phases 0–5, each with tasks,
  deliverables, and an acceptance test that must pass before the next phase starts. Tasks marked
  **[K]** need Kieron; everything else is autonomous.

Read both documents before doing any build work. Do not skip ahead of the current phase or start
a phase before the previous gate has passed.

## Non-negotiable rules from the plan

- **Load the `spoke-fp` skill before writing any TypeScript.** It encodes Spoke's strict
  functional style (no classes, no loops, no `if/else`/`switch`, Ramda, all-`const`, explicit
  return types) — CI-enforced, so code that violates it is rejected.
- **No logic in workflow YAML.** Each GitHub Actions workflow is a thin shell: checkout →
  setup-node → `npm ci` → one `npm run` command with env from secrets, plus a `workflow_dispatch`
  trigger. Any conditional or data threading belongs in the CLI entrypoint under `src/cli/`.
- **Deploying is a git push.** There is no other deployment mechanism.
- **No secrets in repo contents.** Keys live in GitHub repository secrets
  (`ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `TURBOPUFFER_API_KEY`, `FIRECRAWL_API_KEY`,
  `SLACK_BOT_TOKEN`); a `.env.example` documents the set for local runs.
- **All build-time output posts to `#intel-staging`** until the relevant phase gate promotes it
  to `#intel-digest` / `#competitive-intel`.
- Respect the spec's non-goals: no UI, no auth, no scraping of G2/Capterra/LinkedIn, no real-time
  pipeline, no services beyond Firecrawl, TurboPuffer, GitHub, Anthropic, and Voyage.

## Architecture (once built)

One TypeScript repository. TurboPuffer holds **all** state (items per vertical, `registry`,
`reports` namespaces — there is no other database or seen-URL store); GitHub Actions is compute
only; Firecrawl is fetch only. Every workflow is reproducible locally with the same CLI command
and a `.env` file.

- **P — processing pipeline** (`src/pipeline/`, a library, not a workflow): normalize → hash →
  classify (Claude Haiku, single call) → embed (Voyage) → three-layer dedupe (exact
  `content_hash`; embedding neighbour ≥ 0.90 similarity arbitrated by a Haiku call returning
  duplicate/same_story/distinct; canonical-URL selection on merge) → upsert. Complaint/outage
  items at or above the sentiment threshold also alert to Slack immediately.
- **W0 — registry editor** (`workflow_dispatch`): typed form inputs → CLI flags; validates
  competitor names before writing. The registry is edited only through W0.
- **W1 — feed ingest** (daily cron): feeds + job boards → seen-URL filter → P.
- **W2 — crawl** (weekly cron): Firecrawl change-tracking jobs, polled to completion in-run;
  classification runs on the diff plus page context.
- **W3 — weekly report** (Sunday cron, per vertical + competitor): cluster (shared `story_id`
  first, then embedding), Haiku per-cluster summaries, one Claude Opus synthesis pass with the
  previous report (from the `reports` namespace) in context, then deliver and upsert.

Planned layout: `src/{clients,pipeline,report,registry,cli}`, `test/fixtures`,
`.github/workflows/{w0-registry,w1-ingest,w2-crawl,w3-report}.yml`.

## Development (once code exists)

- Node/TypeScript per the plan; entrypoints run via `npm run` scripts (one per workflow), locally
  with `.env`.
- Unit tests cover every pure function (normalize, hash, cluster, canonical selection, dedupe
  verdict handling) against fixtures in `test/fixtures`, and run in CI on every push.
- Failure handling: every entrypoint posts its own failures to Slack with context; ingestion is
  idempotent, so re-running any workflow is always safe. No custom retry logic.
- Threshold changes (dedupe candidate similarity starts at 0.90; alert sentiment starts at
  `moderate`) must be logged in `docs/tuning-log.md` with date and reason.
