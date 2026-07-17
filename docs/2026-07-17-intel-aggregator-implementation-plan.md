# Aggie — Internal Intel Aggregator (Implementation Plan)

**Date:** 2026-07-17 (rev 2 — orchestration moved from Pipedream to GitHub Actions)
**Companion document:** `2026-07-17-intel-aggregator-spec.md`
**Build mode:** Autonomous (Claude builds; Kieron provisions accounts and reviews at phase gates)

## How to read this document

Section 1 is Kieron's checklist: everything to provision before the build starts, in one place. Sections 2–7 are the build phases. Each phase lists the tasks, the deliverables, and an acceptance test that must pass before the next phase starts. Tasks marked **[K]** need Kieron; everything else is autonomous. Deploying at every phase is a git push — there is no other deployment mechanism in the system.

## 1. Prerequisites — set up before the build starts

### 1.1 Accounts and API keys

| Service | What to provide | Notes |
|---|---|---|
| Anthropic | API key | Needs access to current Haiku and Opus models |
| Voyage AI | API key | Any current general-purpose embedding model |
| TurboPuffer | API key + chosen region | Pick a US region (close to GitHub's runners) rather than NZ — every run queries it |
| Firecrawl | API key | Paid tier; confirm the plan includes change-tracking. Webhooks are NOT needed — W2 polls |
| Slack | Bot token with `chat:write`, invited to the three channels below | Or per-channel incoming webhooks if you prefer not to create a bot |
| GitHub | Empty private repo (suggested name: `aggie`), Actions enabled, write access for the build agent, plus permission to set repository secrets (or set them yourself per 1.4) | The repo is the entire deployment surface |

### 1.2 Slack channels

Create and confirm names for:
- `#intel-digest` — weekly reports land here
- `#competitive-intel` — immediate complaint/outage alerts land here
- `#intel-staging` — build-time output; everything posts here until the phase-gate review passes

### 1.3 Decisions to confirm (one line each)

- First vertical to launch: plan assumes **finance** (densest source list, fastest validation).
- Digest delivery time: plan assumes **Sunday 18:00 NZT**.
- Email delivery is deferred to phase 5; when we get there, provide a Resend or Postmark API key. Slack-only until then.

### 1.4 Secrets placement

All keys go into GitHub repository secrets (`ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `TURBOPUFFER_API_KEY`, `FIRECRAWL_API_KEY`, `SLACK_BOT_TOKEN`). The agent sets them via `gh secret set` if its token has admin on the repo; otherwise you paste them once in repo Settings → Secrets. No secrets in the repo contents, and a `.env.example` documents the set for local runs.

## 2. Phase 0 — Environment verification and scaffolding

**Tasks**
1. Verify every API key works with one minimal authenticated call per service; report any failures as a blocker list.
2. Verify the deploy loop end-to-end: push a hello-world workflow, trigger it via `workflow_dispatch`, confirm it reads a repo secret and posts one line to `#intel-staging`. This proves the entire deployment surface before any real code exists.
3. Create TurboPuffer namespaces: `registry`, `items-finance`, `items-insurance`, `items-healthcare`, `items-competitor`, `reports`.
4. Scaffold the repo: TypeScript, following Spoke's functional style guide (the build agent must load the `spoke-fp` skill before writing any TypeScript). Layout:

```
/.github/workflows   # w0-registry.yml, w1-ingest.yml, w2-crawl.yml, w3-report.yml — thin shells only
/src
  /clients           # thin typed wrappers: turbopuffer, anthropic, voyage, firecrawl, slack
  /pipeline          # normalize, hash, classify, embed, dedupe, upsert (the P library)
  /report            # cluster, summarize, synthesize, format
  /registry          # read/write/validate registry records
  /cli               # one entrypoint per workflow: ingest.ts, crawl.ts, report.ts, registry.ts
/test
  /fixtures          # recorded feed items, crawled pages, syndicated-duplicate pairs
/docs
```

Workflow YAML rule, enforced from the first file: no logic in YAML. Each workflow is checkout → setup-node → `npm ci` → one `npm run` command with env from secrets, plus a `workflow_dispatch` trigger for manual re-runs. Any conditional or data threading belongs in the CLI entrypoint.
5. Seed the registry: research and load the initial source list for finance (regulator feeds, EDGAR feeds for RingCentral and 8x8, status pages, competitor blogs/changelogs, Greenhouse/Lever endpoints) plus the competitor records (RingCentral, 8x8, Aircall, UJET, Twilio Flex as displace; Theta Lake, Smarsh as partner). Output the seeded list as `docs/sources-v1.md` for review.

**Deliverables:** working repo scaffold with the four workflow shells, verified deploy loop, namespaces created, seeded registry, blocker list (empty or not).
**Gate [K]:** review `docs/sources-v1.md` and the blocker list. ~15 minutes.

## 3. Phase 1 — Feeds end-to-end (finance vertical)

**Tasks**
1. Implement the P library: fetch feed → filter seen URLs → normalize → hash → classify (Haiku, schema per spec) → embed (Voyage) → layered dedupe (spec §P) → upsert.
2. Implement the `ingest` entrypoint (feed sources only) behind `w1-ingest.yml` on the daily cron.
3. Implement the `report` entrypoint minimally: pull trailing 7 days, cluster (story_id then embedding), Haiku cluster summaries, Opus synthesis with previous report from `reports` namespace, format, post to `#intel-staging`, upsert report. Deploy behind `w3-report.yml`.
4. Implement the `registry` entrypoint behind `w0-registry.yml` (`workflow_dispatch` typed inputs → CLI flags), with competitor-name validation.
5. Unit tests for every pure function (normalize, hash, cluster, canonical selection, dedupe verdict handling) against fixtures, including at least three real syndicated-duplicate pairs and one press-release-inside-article case. Tests run in CI on every push.
6. Backfill run: ingest the last 14 days of feed content so the first report has material and the dedupe layers get exercised on real syndication.

**Acceptance test:** two consecutive scheduled daily runs complete without intervention; a manually dispatched W3 produces a finance digest in `#intel-staging` where no story appears twice and every item links a canonical URL.
**Gate [K]:** read the staging digest; judge whether the content is worth receiving weekly. This is the go/no-go for the whole tool. ~15 minutes.

## 4. Phase 2 — Job boards and the alert branch

**Tasks**
1. Job-board client: Greenhouse/Lever JSON endpoints per competitor; postings classified as `hiring_signal` with location/role extraction.
2. Alert branch in P: classification `complaint` or `outage` at or above the sentiment threshold posts immediately to `#intel-staging` (moves to `#competitive-intel` at the phase gate).
3. Extend fixtures and tests: complaint text → complaint classification with sentiment; status-page incident → outage; job-posting batch → hiring signal.

**Acceptance test:** one week of scheduled runs; digest includes a competitor section with job-board and feed-sourced items; at least one alert fires end-to-end (seed a fixture complaint or outage if the week is quiet).
**Gate [K]:** review alert quality — the risk here is noisy alerts training sales to ignore the channel. Tune the sentiment threshold for alerting (starts at `moderate`) before promoting to the real channel. ~15 minutes.

## 5. Phase 3 — Firecrawl change-tracking

**Tasks**
1. Implement the `crawl` entrypoint behind `w2-crawl.yml` (weekly cron): read crawl sources from the registry, start Firecrawl jobs in change-tracking mode, poll to completion within the run, discard unchanged pages and seen URLs, process the rest through P.
2. Diff handling in P: changed-page items carry the diff, and classification runs on the diff plus page context, so a pricing change is classified from what changed, not the whole page.
3. Failure-footer plumbing: W3 lists sources that failed or returned nothing across all source kinds, and every entrypoint posts its own failures to Slack with context.

**Acceptance test:** a full weekly cycle where at least one tracked page change (there is almost always one) appears in the digest correctly classified, and the footer accurately reports any dead sources.
**Gate [K]:** review, then promote all output from `#intel-staging` to `#intel-digest` and `#competitive-intel`. Cutover complete.

## 6. Phase 4 — Remaining verticals

Insurance and healthcare are registry entries, not code: seed their sources (agent researches, Kieron reviews as in phase 0), and add their cron entries to `w3-report.yml`. No new components.

**Acceptance test:** three digests arrive on Sunday, each vertical-correct.

## 7. Phase 5 — Hold, then email

Run the system untouched for four weeks (per spec: stop and observe). The only work in this window is registry edits via W0 and threshold tuning if dedupe or alerts misbehave, each logged in `docs/tuning-log.md`. After the hold, add email delivery to the report entrypoint (Resend/Postmark key needed then) if Slack alone hasn't proven sufficient — skipping email entirely is an acceptable outcome.

## 8. Operational deliverables (produced during the build)

- `docs/runbook.md` — adding a source or competitor via W0; disabling a source; reading the failure footer; rotating a secret; running any entrypoint locally with `.env`; the kill switch (disable the workflows in the Actions tab — the system has no other moving parts).
- `docs/tuning-log.md` — every threshold change with date and reason (dedupe candidate threshold starts at 0.90; alert sentiment threshold starts at `moderate`).
- `docs/sources-v1.md` — the reviewed initial registry, kept current by W0 exports at each phase gate.

## 9. Total Kieron time budget

Provisioning (section 1): roughly 45 minutes. Phase gates: four reviews of ~15 minutes each, spread across the build. Everything else is autonomous.
