# Aggie — Prospect Scanning from Job Postings (Spec)

**Date:** 2026-08-05
**Status:** Specced — build unscheduled ([K] decides when)
**Audience:** Internal only (Spoke sales)
**Companion documents:** `2026-07-17-intel-aggregator-spec.md` (main spec),
`2026-07-17-intel-aggregator-implementation-plan.md` (§10 carries this branch's phase entry)

## Purpose

Detect prospect companies in Spoke's target verticals from their hiring patterns, and alert
sales immediately with evidence. The motivating example: a wealth advisory firm hiring remote
advisors and compliance officers at the same time is a strong Spoke prospect. This branch
produces buying-intent signals about companies we might sell to — a different purpose and
audience from the intel branches, which produce news about regulators and competitors.

This supersedes the purpose of the deferred job-board ingestion (main spec §4 phase 2 task 1,
deferred 2026-07-24). That design polled known competitors' ATS boards for `hiring_signal`
digest items; this one discovers unknown companies across the whole US job market. The seeded
`job_board` registry rows and the `hiring_signal` classification stay as they are —
seeded-but-unfetched and unused respectively — and are not repurposed here.

## Scope

- **Verticals:** the current target verticals — finance, insurance, healthcare. The design is
  per-vertical (queries and rubric keyed by vertical) so adding a vertical is a new entry, not
  new machinery.
- **Geography:** US only.
- **Delivery:** immediate Slack alerts, one per company, to `#intel-prospects` after the
  quality gate (staging until then). No digest section, no weekly roll-up.

## Non-goals

- No outreach automation and no CRM integration. The alert is where this system stops.
- No person-level data. TheirStack exposes hiring-manager names and LinkedIn profiles; we do
  not fetch, store, or post them.
- No LinkedIn/G2/Capterra scraping (unchanged from the main spec). TheirStack is a licensed
  aggregation API, not scraping by us.
- No per-posting output. The unit of signal is the company; individual postings appear only
  as evidence links inside a company alert.

## Signal model

The signal is a **company-level co-occurrence pattern**, not any single posting: a company in
a target vertical hiring for customer-facing communication roles *and* compliance roles in
the same window. One side alone is weak (every firm hires advisors; every firm hires a
compliance officer eventually); the combination is a company scaling regulated, human,
phone-heavy communication — Spoke's ICP moment.

Per-vertical rubric (v1 — [K] reviews before any build; role lists are starting points):

| Vertical | Customer-facing roles | Compliance roles |
|---|---|---|
| finance | financial advisor, wealth manager, broker, financial planner, client associate | compliance officer, supervision principal, BSA/AML officer, registered principal |
| insurance | insurance agent, producer, claims adjuster, customer service rep (agency) | compliance officer, licensing/compliance analyst, market conduct |
| healthcare | patient scheduler, patient access rep, telehealth coordinator, care navigator | compliance officer, HIPAA privacy officer, health information manager |

**Strengtheners** (raise a weak match to strong, or feature in the rationale): remote or
work-from-home postings (distributed teams need cloud telephony); multiple simultaneous
openings for the same role; company size inside Spoke's ICP band ([K] confirms the band at
rubric review — v1 assumes it exists and is expressible as a TheirStack employee-count
filter).

**Exclusions:** companies in the competitor registry (matched by name and aliases), and
companies inside the alert cooldown (see state below).

## Data source

**TheirStack** job-postings API — a new approved service for this branch only (amends the
main spec's non-goal capping services at Firecrawl / TurboPuffer / GitHub / Anthropic /
Voyage). Chosen 2026-08-05 over JSearch, Adzuna, and Coresignal: purpose-built for
hiring-signal prospecting, cross-source deduplication built in (postings appear 3–5× across
boards), company firmographic filters (industry, employee count), and a self-serve free tier
to validate coverage before paying.

- **Endpoint use:** the job-search endpoint only, filtered by role-title group × US ×
  posted-within-window × vertical industry filters. Postings are grouped by company
  client-side; the company-lookup endpoint costs 3 credits per record versus 1 for jobs and
  adds nothing we can't derive from the postings.
- **Credits:** free tier is 200 job records/month — enough for a weekly pilot (~45
  postings/week across three verticals). The $59/month plan buys ~1,500 records/month with
  credits valid a year. [K] decides on paying only after the pilot gate.
- **Secret:** `THEIRSTACK_API_KEY` in GitHub repository secrets, documented in
  `.env.example`. [K] provisions the account.

## Architecture

One new pipeline and one new workflow, alongside — not through — pipeline P. P is item-shaped
(classify one document); this branch is company-shaped (score a set of postings), so it
shares P's conventions (idempotence, failure posting, thin YAML) but none of its stages. No
Voyage embeddings: matching here is exact (company domain) not semantic.

**Prospect pipeline (library under `src/prospects/`).** Per scheduled run, per vertical:

1. Query TheirStack for postings matching the vertical's role-title groups (both sides of the
   rubric), US, posted within the lookback window (start: 30 days — wide enough to catch
   both sides of a co-occurrence that didn't start the same week).
2. Group postings by company domain.
3. Drop companies matching the competitor registry (name/aliases) and companies inside the
   cooldown window in the `prospects` namespace.
4. For each remaining company with postings on both sides of the rubric: one Claude call
   scores the posting set against the vertical rubric — `strong` / `weak` / `none`, a
   why-now rationale, and the evidence postings. (Companies with only one side present are
   recorded but not scored — no LLM spend on non-signals.)
5. `strong` → post the alert and upsert the company to `prospects` with `last_alerted_at`.
   `weak` / `none` → upsert without alerting, so repeated scans accumulate history.

**Queries and rubric prompts live in code** (`src/prospects/queries.ts`, one typed constant
per vertical), not the registry. TheirStack queries are structured objects (title arrays,
industry filters) that don't fit W0's typed url-field form inputs, and deploy is a git push
anyway. Tradeoff accepted: adding a vertical's queries is a commit, not a W0 dispatch.

**W4 — Prospect scan (`w4-prospects.yml`, weekly cron + `workflow_dispatch`).** Thin shell
per house rules: checkout → setup-node → `npm ci` → `npm run prospects`. Weekly cadence keeps
the pilot inside the free credit tier; "immediate" means an alert posts during the run that
detects it — detection latency is bounded by the scan cadence, the same caveat the main spec
accepts for status-page crawls. Cadence tightens only with evidence, logged in
`docs/tuning-log.md`.

**Failure handling:** the entrypoint posts its own failures to Slack with context, and runs
are idempotent — the `prospects` namespace makes re-runs and overlapping lookback windows
safe (already-alerted companies are inside the cooldown; already-seen postings change
nothing). No custom retry logic.

## Data model

**Prospects namespace (TurboPuffer)** — one document per company ever considered, dummy
vector (all matching is by attribute):

| Attribute | Type | Notes |
|---|---|---|
| `domain` | string | company domain from TheirStack — the identity key |
| `name` | string | display name |
| `vertical` | string | finance / insurance / healthcare |
| `score` | string | strong / weak / none — latest evaluation |
| `rationale` | string | latest why-now text (strong/weak only) |
| `posting_hashes` | string[] | hashes of postings already seen for this company |
| `first_seen` | timestamp | first run that surfaced the company |
| `last_evaluated_at` | timestamp | latest scoring run |
| `last_alerted_at` | timestamp | empty unless a strong alert has fired |

**Cooldown:** a company with `last_alerted_at` inside the last **90 days** is never
re-alerted, regardless of new postings — re-runs, long-lived postings, and slow-rolling
hiring plans produce one alert, not a drip. Threshold changes go in `docs/tuning-log.md`
with date and reason, per house rules.

## Alert format

One Slack message per strong company, posted as detected:

> 🎯 **Prospect — finance**: Meridian Wealth Partners (~85 employees, Denver CO)
> Hiring 4 remote financial advisors and a compliance supervision principal simultaneously —
> scaling a distributed advisory team under supervision requirements.
> 🔗 Senior Financial Advisor (Remote) · Financial Advisor ×3 · Compliance Principal

- Header: vertical + company name + size/location when TheirStack provides them.
- Body: the model's why-now rationale grounded in the postings — same grounding bar as the
  digest (claims traceable to evidence).
- Context row: each evidence posting as a named link to the original listing.
- Channel: `#intel-staging` until the quality gate; then `#intel-prospects` via the same
  single-constant promotion mechanism the alert branch uses (`ALERT_CHANNEL` pattern in
  `src/pipeline/alert.ts`). Ops posts (📭/❌) stay in staging permanently, as everywhere else.

## Gates [K]

1. **Rubric review** (before build starts): role lists per vertical, the ICP size band, and
   the strengthener list. ~15 minutes.
2. **Pilot review** (free tier, before paying): does the co-occurrence pattern actually
   surface in TheirStack's data for our verticals? Judged on a few weeks of scan output in
   staging. If the pattern isn't detectable, stop here at zero cost.
3. **Alert-quality review** (before channel promotion): the same risk as the intel alert
   branch — noisy alerts train sales to ignore the channel. Tune the score threshold and
   cooldown, then promote `#intel-staging` → `#intel-prospects`. ~15 minutes.

Build scheduling is not part of this spec: [K] decides when this branch starts relative to
the intel branches' observation hold.

## Resolved decisions

- **Data source: TheirStack** (2026-08-05) over JSearch (cheaper but no dedupe, no company
  filters — we'd rebuild both), Adzuna (thin US coverage; ToS requires a license for ongoing
  commercial use), Coresignal (LinkedIn-heavy, no dedupe, enterprise pricing).
- **Company-shaped pipeline, not P** — the signal is a pattern across postings; forcing it
  through item classification would score fragments of the signal, not the signal itself.
- **No embeddings** — company identity is exact (domain); nothing here needs similarity.
- **Queries in code, not registry** — structured query objects don't fit W0's form inputs;
  deploy is a git push.
- **Delivery: immediate alerts to a dedicated `#intel-prospects` channel** (Kieron,
  2026-08-05) — sales-facing buying-intent output kept separate from competitor/regulatory
  intel.
- **US only, current target verticals** (Kieron, 2026-08-05) — verticals added later reuse
  the per-vertical structure.
