# Changelog

All notable changes to Aggie. Dates are NZT.

## [Unreleased]

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
