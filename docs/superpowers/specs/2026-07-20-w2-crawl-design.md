# Phase 3 — W2 Firecrawl change-tracking: design

Date: 2026-07-20
Status: approved (phase reorder per plan amendment 2026-07-20; builds before job boards/alerts)

## Goal

Implement W2 per spec §W2: weekly crawl of the registry's `crawl` sources through Firecrawl
change-tracking, classify what changed (diff + page context), feed new/changed content through
P, and make the digest footer report quiet sources. Unlocks the feedless high-value targets
(status pages, Smarsh/8x8 newsrooms, FinCEN — and later the 10DLC trackers).

## Firecrawl API (verified against current docs)

- Start: `POST /v2/batch/scrape` with `{ urls, formats: ["markdown", { "type": "changeTracking",
  "modes": ["git-diff"] }] }` → `{ id }`. Markdown format is required for change tracking.
- Poll: `GET /v2/batch/scrape/{id}` → `{ status: pending|processing|completed|failed, next,
  data: [...] }`; follow `next` links to accumulate all pages.
- Per page: `data[].metadata.sourceURL`, `data[].metadata.title`, `data[].markdown`,
  `data[].changeTracking.{ changeStatus: new|same|changed|removed, diff?.text }`.

## Decisions

1. **One batch job per run** for all active crawl URLs, polled in-run (15s interval, 15 min
   deadline). No webhooks (spec). Abort with a Slack ❌ if the job fails or times out.
2. **Page dispositions:** `same`/`removed` → discard. `new` → seen-URL check (existing item
   with that URL ⇒ skip), else process full page markdown (truncated 20k chars) — the first
   run is a baseline pass and its items go through the normal relevance gate. `changed` →
   ALWAYS process (bypasses seen-URL by design): content = git diff + a 4k-char excerpt of the
   current page, so classification runs on what changed plus context (spec §W2). Titles for
   changed pages are `"<source name> — page updated"`.
3. **Self-page dedupe rule (P change):** a changed page's item re-enters P with the page URL,
   so its own previous version is its nearest neighbour. `layer2StoryId` gains a deterministic
   branch: neighbour URL === item URL ⇒ `same_story` with the neighbour's story id, no Haiku
   arbitration. This (a) prevents a `duplicate` verdict from silently merging away the change,
   (b) keeps story continuity so W3 clusters successive changes as a continuing story, and
   (c) means the new version overwrites the old item (same `item:<sha16(url)>` id) — history
   lives in past reports, per "TurboPuffer holds all state" minimalism.
4. **Relationship on crawl items:** from the source's competitor's registry record
   (displace/partner); `regulatory` when the source has no competitor (e.g. FinCEN).
5. **Quiet-source footer (plan task "failure-footer plumbing"):** no failures namespace. Hard
   fetch failures keep posting ⚠️ in-run (existing pattern). The W3 footer derives quiet
   sources: active sources (feed + crawl) for the vertical with zero relevant items in the
   trailing 7 days — worded as "quiet (may be fine)" since sparse sources are normal. Items
   already carry `source`; the attribute has existed since the first phase-1 write, so adding
   it to the report query is schema-safe (per the CLAUDE.md gotcha).
6. **Credits guard:** before starting, `remainingCredits()` must cover the URL count, else
   abort with a clear Slack error.
7. **Cron:** Saturday 02:00 UTC (W1 daily 02:00, W3 Sunday 06:00) — crawl results land before
   the Sunday digest.

## Code changes

- `src/clients/firecrawl.ts` — `startChangeTrackingBatch(urls)`, `getBatchResults(jobId)`
  (with `next` pagination), `ChangeStatus` enum, `CrawlPageResult` type.
- `src/pipeline/crawl.ts` (new, pure) — `crawlRawItem(source, relationship, page, nowIso)`:
  disposition + content assembly; exported constants for truncation lengths.
- `src/pipeline/process.ts` — `layer2StoryId` self-page branch (signature gains the item);
  neighbour query must return `url` and `story_id` attributes.
- `src/cli/crawl.ts` — replace stub: load sources → credits guard → batch → poll → map pages
  to sources → seen-filter new pages → `processRawItem` each → ⚠️ per-failure posts + summary
  post to staging.
- `src/report/format.ts` + `src/report/generate.ts` + `src/cli/report.ts` — `quietSources`
  pure helper; `ReportItem.source` (+ query attribute); footer wiring.
- `.github/workflows/w2-crawl.yml` — add the Saturday cron (shell already exists with npm ci).

## Testing

Fetch-mocked client tests (start, status mapping, pagination, HTTP errors); pure tests for
`crawlRawItem` (all four dispositions, truncation, title/content shape) and `quietSources`;
`layer2StoryId` self-page branch test (no network call needed — arbitration is skipped);
footer test updates. CLI crawl entrypoint is orchestration — verified by a live dispatched run
in staging (task 5), consistent with ingest/report.

## Acceptance (per plan §5, window at Kieron's discretion)

A dispatched W2 run completes: batch finishes in-run, summary posts to staging, first-run
baseline items stored. Full acceptance — a real tracked page change appearing correctly
classified in a digest — needs an actual change to occur; Kieron reviews when one lands.

## Out of scope

Job boards + alert branch (next phase); adding the 10DLC tracker crawl targets to the registry
(a W0/seed follow-up once W2 is proven); Firecrawl webhooks; per-page crawl scheduling.
