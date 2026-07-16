# Aggie — Internal Intel Aggregator (Spec)

**Date:** 2026-07-17 (rev 2 — orchestration moved from Pipedream to GitHub Actions)
**Status:** Approved
**Audience:** Internal only (Spoke sales, marketing, leadership)

## Purpose

Collect regulatory news and competitor intelligence relevant to Spoke's ICP verticals, and deliver one weekly digest per vertical plus immediate alerts for time-sensitive items. The tool replaces ad-hoc manual monitoring. It is an internal tool: correctness of the digest matters, polish does not.

## Non-goals

These are excluded to keep the build small. Each one is a deliberate cut, not an oversight.

- No UI built by us. Output goes to Slack and email; the registry is edited through a GitHub Actions `workflow_dispatch` input form.
- No user accounts, auth, or multi-tenancy.
- No scraping of G2, Capterra, or LinkedIn. Their terms prohibit it. The report template carries a manual-check section for these instead.
- No real-time pipeline. All work runs on daily and weekly crons; alert latency is bounded by the daily ingest cadence, which is acceptable for this audience.
- No custom infrastructure and no orchestration service. Firecrawl, TurboPuffer, and GitHub (repo + Actions) are the only services, plus the Anthropic and Voyage APIs.

## Content tracks

**Track 1 — Regulatory (per vertical: finance, insurance, healthcare).** Enforcement actions, rule changes, and guidance that touch communications compliance, paired with law-firm and trade-press commentary on those actions.

**Track 2 — Competitor.** Two sets with different intent:

- *Displacement set* (RingCentral, 8x8, and the Flex/UJET/Aircall category): product announcements, pricing changes, outages, customer complaints, expansion signals.
- *Partner set* (Theta Lake, Smarsh): partnership and M&A announcements, integration-coverage changes, event presence, capability gaps customers complain about.

Every stored item carries a `relationship` value (`displace` or `partner` for track 2, `regulatory` for track 1) that drives classification and report treatment.

## Source list (v1)

**Feeds (no crawling required):**

- SEC, FINRA, HHS/OCR, and state-regulator press-release feeds for the three verticals
- SEC EDGAR per-company feeds for RingCentral and 8x8 (earnings, 10-Q/10-K)
- RingCentral and 8x8 status-page incident feeds
- Competitor press-release and blog feeds where published

**Reddit API (search, weekly):** competitor names across r/VoIP, r/sysadmin, r/msp, and vertical-relevant subreddits.

**Job boards (JSON, no scraping):** Greenhouse/Lever public endpoints for each competitor.

**Firecrawl (weekly, change-tracking mode):** competitor pricing pages, changelogs and release notes, customer/case-study index pages, Theta Lake and Smarsh partner/integration directory pages, plus industry publications without feeds.

**Manual section in report template:** G2/Capterra reviews, LinkedIn.

The registry of competitors and sources lives in a TurboPuffer namespace (schema in the data model section). Reads are attribute-filter queries at the start of each run; writes go through W0, a `workflow_dispatch` workflow whose typed inputs are the add/edit form. No deploy to add a source, and no separate database.

## Architecture

One repository. All logic is TypeScript; each workflow is a thin YAML shell (checkout, setup Node, install, run one CLI command) so that every code path is reproducible locally with the same command and a `.env` file. TurboPuffer holds all state; Actions is compute only; Firecrawl is fetch only. Deploying is a git push.

**P — Processing pipeline (library, not a workflow).** Shared by W1 and W2. For each item: one Claude Haiku call classifies and extracts (schema below), one Voyage embedding call produces the vector, then dedup runs in layers before upsert. Layer 1: normalize the markdown and hash it; an exact `content_hash` match in the namespace is a verbatim reprint — merge the URL into the existing item and stop. Layer 2: if no hash match, query the embedding against the namespace; a neighbour above 0.90 similarity triggers one Haiku comparison call returning `duplicate` (merge), `same_story` (store as a new item stamped with the neighbour's id as `story_id`), or `distinct` (store normally). Layer 3, on any merge: keep the copy from the originating domain (company newsroom or regulator) over syndicators, falling back to earliest `published_at`; reports link the canonical URL first. If classification is `complaint` or `outage` at or above the alert sentiment threshold, the item also posts immediately to the #competitive-intel Slack channel.

**W0 — Registry editor (`workflow_dispatch`).** Adds or updates a competitor or source record via typed form inputs passed to the CLI. Validates that a source's competitor name exists in the registry before writing, so a typo cannot silently create a new competitor.

**W1 — Feed ingest (daily cron).** Reads feed, Reddit, and job-board sources from the registry, fetches each, filters out already-seen URLs, and runs new items through P. (Reddit and job-board sources carry a weekly flag and only run on their day.)

**W2 — Crawl (weekly cron).** Reads the Firecrawl sources from the registry, starts the Firecrawl jobs in change-tracking mode, polls them to completion within the same run, discards unchanged pages and already-seen URLs, and runs new or changed content through P. Changed pages carry the diff, and classification runs on the diff plus page context, so a pricing change is classified from what changed, not the whole page.

**W3 — Weekly report (Sunday cron, one run per vertical plus one competitor run).** Queries TurboPuffer for the trailing 7 days, clusters items — shared `story_id` groups first, embedding similarity for the remainder — writes one summary per cluster with Claude Haiku, then one Claude Opus synthesis pass with the previous report in context. The previous report comes from the `reports` namespace (filter by vertical, latest `report_date`). After synthesis, W3 upserts the new report to the `reports` namespace and delivers it to Slack and email. The competitor report has one section per competitor, with partner-set items framed as opportunity, not threat.

**Failure handling:** every entrypoint posts its own failures to Slack with context, so failures are read in the channel, not in Actions logs. Ingestion is idempotent (the seen-URL check), so re-running any workflow is always safe; every workflow also carries a `workflow_dispatch` trigger as a manual re-run button. The weekly report notes source failures in a footer so gaps are visible. Actions cron is best-effort — runs can start minutes late and are rarely skipped — which is acceptable at this cadence; a skipped daily run self-heals the next day. No custom retry logic.

## Data model

**TurboPuffer item attributes:**

| Attribute | Type | Notes |
|---|---|---|
| `url` | string | canonical URL |
| `source` | string | source id from registry |
| `vertical` | string | finance / insurance / healthcare / competitor |
| `competitor` | string | empty for regulatory items |
| `relationship` | string | regulatory / displace / partner |
| `classification` | string | see schema below |
| `sentiment` | string | complaints only: mild / moderate / severe |
| `published_at` | timestamp | from source metadata, fetch date as fallback |
| `title`, `summary` | string | LLM-extracted |
| `merged_urls` | string[] | duplicates folded into this item |
| `content_hash` | string | hash of normalized markdown, layer-1 dedup key |
| `story_id` | string | id of the first item covering the same event; empty if none |

Vector: one Voyage embedding of title + summary.

**Registry namespace (TurboPuffer):** competitor and source records as documents with a dummy vector. Competitor records: `name`, `relationship` (displace / partner), `aliases` (search terms for Reddit), `active`. Source records: `kind` (feed / reddit / job_board / crawl), `url`, `vertical`, `competitor`, `active`, `added_at`. Written by W0 only; read by W1, W2, and W3.

**Reports namespace (TurboPuffer):** one document per delivered report. Attributes: `vertical`, `report_date`, `body` (full markdown). Vector: a Voyage embedding of the body — not needed for the latest-report fetch (that is an attribute filter), but it lets W3 or anyone ask "have we covered this before" across past reports for free.

**Seen-URL check:** there is no separate store. An item's presence in an items namespace is the seen record: W1 and W2 query for a URL match before processing, and P stores every processed item — including classification `other` — so nothing is fetched or classified twice.

## Classification schema (single LLM call)

Input: item markdown. Output (JSON): `classification` (enforcement_action / rule_change / guidance / commentary / product_announcement / pricing_change / customer_win / complaint / outage / partnership / ma_activity / hiring_signal / other), `sentiment` (complaints only), `title`, `summary` (2–3 sentences), `entities` (competitor and regulator names found).

## Report format

One Slack message + email per vertical, Sunday evening NZT:

1. **New this week** — clustered items, one paragraph each, links to sources (canonical URL first, reprints folded behind it).
2. **Continuing stories** — clusters that also appeared in the previous report, one sentence on what changed.
3. **Competitor sections** (competitor report only) — per competitor: announcements, complaints, signals. Partner-set sections add a "where we fit" line when a coverage gap appears.
4. **Manual checks** — static reminder list (G2, Capterra, LinkedIn) with links.
5. **Footer** — sources that failed this week.

## Build phases

1. **Feeds end-to-end** (W1 → P → W3 for one vertical). Proves the pipeline with zero crawling. ~1 weekend.
2. **Reddit + job boards** into the same path, plus the alert branch (complaint/outage → Slack), which lands here because this phase first produces those classifications.
3. **Firecrawl change-tracking** (W2) on the competitor page set.
4. **Remaining verticals** — registry entries and report crons, no new code.

Stop after phase 4 and run it for a month before adding anything.

## Resolved decisions

- Orchestration: GitHub Actions. Chosen over Pipedream so the entire system is code the build agent deploys with a git push; workflows are thin YAML shells around TypeScript CLI entrypoints, and inbound webhooks are replaced by in-run polling of Firecrawl jobs.
- Embeddings: Voyage.
- LLM: Anthropic — Haiku for classification and per-cluster summaries, Opus for report synthesis.
- Previous-report context: stored in a TurboPuffer `reports` namespace (see data model). No other state store exists.
