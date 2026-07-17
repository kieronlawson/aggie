# Changelog

All notable changes to Aggie. Dates are NZT.

## [Unreleased]

### Phase 1 — Feeds end-to-end, finance vertical (built; acceptance window running)

- 2026-07-17: P pipeline (`src/pipeline/`): normalize+hash, Haiku classification (structured
  output), Voyage embedding, three-layer dedupe (exact hash → ≥0.90 neighbour arbitrated by
  Haiku → canonical-URL selection favouring regulator/newsroom domains), TurboPuffer upsert.
- 2026-07-17: W1 ingest implemented (daily cron 02:00 UTC): registry-driven feed fetch with
  declared-contact UA, malformed-XML sanitization, Firecrawl fallback for bot-blocked hosts
  (JD Supra, Radical Compliance), seen-URL filter, 14-day age cutoff. Backfill ingested ~264
  items across 20/20 sources with 0 failures; re-runs proved idempotent.
- 2026-07-17: W3 report implemented (Sunday cron 06:00 UTC): story_id+embedding clustering,
  Haiku cluster summaries, Opus synthesis with previous report context, mrkdwn conversion,
  threaded Slack delivery to `#intel-staging`, report upsert with non-filterable body; re-runs
  on the same day are skipped. First finance digest delivered.
- 2026-07-17: W0 registry typed commands (`add-competitor`, `add-source`, `set-source-active`)
  with competitor-name validation; workflow inputs passed via env (zizmor-clean).
- 2026-07-17: Real-world fixtures: three SEC off-channel enforcement syndication pairs + one
  press-release-inside-article case (`test/fixtures/dedupe-pairs.json`) exercising normalize,
  hash, and canonical selection. 61 unit tests total.
- 2026-07-17: `docs/runbook.md` and `docs/tuning-log.md` started.
- Remaining for the phase 1 gate: two consecutive scheduled daily W1 runs without intervention
  (cron runs over the next two days), then Kieron's digest-quality review (go/no-go).

### Phase 0 — Environment verification and scaffolding (complete, pending gate review)

- 2026-07-17: Phase 0 verify run green: all five API keys authenticated, six TurboPuffer
  namespaces created, deploy loop proven end-to-end (push → dispatch → secret → Slack post to
  `#intel-staging`). Blocker list: **empty** (caveats recorded in `docs/sources-v1.md` notes).
- 2026-07-17: Registry module (types, row conversion, validation, markdown export) with unit
  tests; registry CLI (`--command seed|export`) behind `w0-registry.yml`.
- 2026-07-17: Registry seeded via W0: 7 competitors, 41 finance + competitor sources, all URLs
  verified by research (SEC/CFTC/FINRA feeds, EDGAR atom for RNG + EGHT, status feeds, blogs,
  Greenhouse/Lever/SmartRecruiters job boards, Firecrawl crawl targets). `docs/sources-v1.md`
  generated for Kieron's gate review.

- 2026-07-17: Repo scaffold: TypeScript (Node 22, ESM, tsx), ESLint flat config enforcing the
  spoke-fp style guide, vitest, pinned exact dependency versions, `#src/*` subpath imports.
- 2026-07-17: Thin typed clients for Slack (fetch), Anthropic (`@anthropic-ai/sdk`), Voyage
  (fetch, `voyage-4`), TurboPuffer (`@turbopuffer/turbopuffer`), Firecrawl (fetch, v2 API).
- 2026-07-17: `verify` entrypoint (`npm run verify` / `phase0-verify.yml`): one authenticated
  call per service, TurboPuffer namespace bootstrap (registry, items-finance, items-insurance,
  items-healthcare, items-competitor, reports), summary posted to `#intel-staging`.
- 2026-07-17: Four thin workflow shells (`w0-registry`, `w1-ingest`, `w2-crawl`, `w3-report`),
  `workflow_dispatch` only — crons are added in the phase that implements each entrypoint.
  CI workflow runs lint + typecheck + tests on every push.
