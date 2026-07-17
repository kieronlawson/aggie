# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Aggie is an internal intel aggregator for Spoke: it collects regulatory news and competitor
intelligence, then delivers weekly Slack/email digests per vertical plus immediate alerts for
complaints and outages. It is being built autonomously by Claude, phase by phase, with Kieron
reviewing at phase gates.

**Current status: phase 0 gate passed; phase 1 built — acceptance window running (two
consecutive scheduled W1 runs), digest-quality gate review pending.** The source of truth is:

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

## What exists today (phase 0 + phase 1)

- **P pipeline** (`src/pipeline/`): `process.ts` orchestrates normalize → hash → layer-1 exact
  dedupe → Haiku classify (structured output) → Voyage embed → layer-2 neighbour arbitration
  (≥0.90, Haiku verdict duplicate/same_story/distinct, unparseable ⇒ distinct) → layer-3
  canonical merge (`ORIGINATING_DOMAINS` beat syndicators) → upsert. Item ids are
  `item:<sha16(url)>`; rows carry `published_at_ms` (uint) for range filters.
- **W1 ingest** (`src/cli/ingest.ts`, daily cron): feeds only; declared-contact UA; malformed-XML
  sanitize fallback; Firecrawl `scrapeRaw` fallback for bot-blocked hosts; seen-URL filter;
  14-day age cutoff (first run = backfill). Per-source failures post as ⚠️ to staging.
- **W3 report** (`src/cli/report.ts`, Sunday 06:00 UTC): trailing 7 days → cluster (story_id then
  centroid ≥0.85) → Haiku summaries → Opus synthesis with previous report → static
  manual-checks/footer sections → **mrkdwn conversion + threaded Slack delivery** (never post raw
  markdown to Slack) → report upsert (`body` must stay non-filterable). Same-day re-runs skip.
- **W0 registry**: `seed | export | add-competitor | add-source | set-source-active`; workflow
  inputs flow through env vars (zizmor: never interpolate inputs into `run:`).
- **Gotchas:** TurboPuffer rejects queries touching attributes absent from a namespace's schema —
  `queryRows` treats that as "no matches" (fresh namespace). Filterable attributes cap at 4KB
  (hence `body` non-filterable). `include_attributes: true` does not return vectors — list
  `"vector"` explicitly.

### Phase 0 scaffold

- **Scaffold:** Node 22 ESM TypeScript run via `tsx` (no build step); ESLint flat config enforces
  the spoke-fp rules; vitest; exact-pinned deps; `#src/*` subpath imports (never relative `..`).
- **Clients** (`src/clients/`): `slack.ts` (fetch; `SlackChannel` enum), `anthropic.ts`
  (`@anthropic-ai/sdk`; `claude-haiku-4-5` + `claude-opus-4-8`), `voyage.ts` (fetch; `voyage-4`,
  1024 dims), `turbopuffer.ts` (`@turbopuffer/turbopuffer`; `TpufNamespace` enum; region from
  `TURBOPUFFER_REGION`, default `gcp-us-central1`), `firecrawl.ts` (fetch, v2 API).
- **Registry** (`src/registry/`): types, TurboPuffer row conversion (`competitor:<slug>` /
  `source:<url-hash>` ids, `record_type` attribute, 1024-dim dummy vector), validation, seed data
  (`seed.ts`), markdown export. Seeded to the `registry` namespace on 2026-07-17 (7 competitors,
  41 sources). `docs/sources-v1.md` is generated — edit `src/registry/seed.ts` and re-export,
  never the doc directly.
- **Entrypoints** (`src/cli/`): `verify.ts` (per-service auth checks + namespace bootstrap +
  staging post; behind `phase0-verify.yml`), `registry.ts` (`--command seed|export`); `ingest`,
  `crawl`, `report` are stubs until their phases.
- **Workflows:** `ci.yml` (lint + typecheck + test on push), `phase0-verify.yml`, and the four
  thin shells `w0-registry` / `w1-ingest` / `w2-crawl` / `w3-report` (`workflow_dispatch` only —
  add each cron in the phase that implements the entrypoint).
- All six TurboPuffer namespaces exist; each contains an idempotent `_bootstrap` marker row
  (no `url`/`record_type` attributes, so production queries never match it).

### Source-specific constraints (from phase 0 research — see docs/sources-v1.md notes)

- Every `sec.gov` request (feeds + EDGAR) must send a declared-contact User-Agent
  (e.g. `Aggie Intel research@spokephone.com`) or it 403s.
- FINRA feeds are `http://` only; FinCEN and the RingCentral/8x8 status pages have no feeds
  (crawl targets); RingCentral/8x8 job boards are Workday POST APIs, seeded inactive.

## Development

- Commands: `npm run check` (lint + typecheck + test — run before every commit),
  `npm run verify|ingest|crawl|report|registry` (entrypoints; load `.env` if present via
  `--env-file-if-exists`).
- Unit tests cover every pure function (normalize, hash, cluster, canonical selection, dedupe
  verdict handling) against fixtures in `test/fixtures`, and run in CI on every push.
- Failure handling: every entrypoint posts its own failures to Slack with context; ingestion is
  idempotent, so re-running any workflow is always safe. No custom retry logic.
- Threshold changes (dedupe candidate similarity starts at 0.90; alert sentiment starts at
  `moderate`) must be logged in `docs/tuning-log.md` with date and reason.
