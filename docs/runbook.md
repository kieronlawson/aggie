# Aggie runbook

## Adding a source or competitor

Actions → **w0-registry** → Run workflow. Pick the command and fill the relevant fields:

- `add-competitor`: name, relationship (displace/partner), aliases (comma-separated).
- `add-source`: name, kind (feed/job_board/crawl), url, vertical, competitor (empty for
  regulatory sources — the competitor must already exist, typos are rejected).
- `set-source-active`: url + active true/false — use this to disable a dead source.
- `seed`: re-applies the checked-in seed (`src/registry/seed.ts`). Idempotent.

Every W0 run posts what it did to `#intel-staging`.

## Running the crawl (W2)

Actions → **w2-crawl** → Run workflow (also runs on the Saturday cron). The run reads active
crawl sources from the registry, starts one Firecrawl change-tracking batch, and polls it to
completion in-run (15-minute deadline — a timeout fails the run with a ❌ post; re-running is
safe). Unchanged pages and already-seen new URLs are discarded; new/changed pages go through P
with classification on the diff plus page context. Every run posts a 🕸️ summary to
`#intel-staging` (pages checked / changed / new / stored / merged, with ⚠️ lines for per-page
failures). The first run is a baseline: every page is `new`. A credits guard fails the run
before starting the batch when the Firecrawl balance is below one credit per page.

## Reading the failure footer

Each digest ends with a **Footer** listing sources that failed that week (full plumbing lands in
phase 3). Ingest failures also post immediately to `#intel-staging` as ⚠️ lines with the source
name and error. A failing source self-heals on the next run if the cause was transient.

## Running any entrypoint locally

```sh
cp .env.example .env   # fill in the five keys
npm ci
npm run ingest                        # W1
npm run report -- --vertical finance  # W3
npm run registry -- --command export  # W0 (read-only)
npm run verify                        # phase-0 style health check of all five services
```

Every workflow is exactly one of these commands — behaviour is identical locally and in Actions.

## Re-running a workflow

Actions → pick the workflow → Run workflow. All entrypoints are idempotent: ingest skips seen
URLs, the report skips a vertical+date it already delivered, registry upserts by stable id.

## Rotating a secret

Repo Settings → Secrets and variables → Actions → update the key. Nothing else to do — the next
run picks it up. Locally, update `.env`.

## Kill switch

Actions tab → select the workflow (w1-ingest / w3-report / …) → “…” menu → **Disable workflow**.
The system has no other moving parts: no servers, no queues, nothing else to stop.
