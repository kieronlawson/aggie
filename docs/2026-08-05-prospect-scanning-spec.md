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

The signal is a **company-level pattern**, not any single posting (Kieron, 2026-08-05,
superseding the same-day v1 "concurrent hiring both sides" model as too narrow):

1. **Revenue-generating customer-facing roles, remote or hybrid** — currently hiring. Remote/
   hybrid is a requirement, not a strengthener: distributed revenue teams are the cloud-
   telephony moment. On-site-only postings don't qualify.
2. **A compliance function**, evidenced either way:
   - *growing* — compliance roles currently posted, or
   - *active* — compliance roles posted within the trailing window (start: 18 months).
   Postings are the only data this branch uses, so an "active compliance org" is proxied by
   compliance hiring history, via a company-filtered historical query.
3. **Size floor: 500+ employees** — the proxy for Spoke's ≥200 end-user minimum. Applied as
   a TheirStack employee-count filter, so smaller companies never cost a credit or an LLM
   call.

Revenue roles alone are every growing firm; a compliance org alone is every regulated firm.
The combination at 500+ staff is a company scaling regulated, distributed, phone-heavy
revenue work — Spoke's ICP moment.

Per-vertical rubric (v1 — [K] reviews before any build; role lists are starting points):

| Vertical | Revenue-generating customer-facing roles (remote/hybrid required) | Compliance roles (posted now = growing; trailing window = active) |
|---|---|---|
| finance | financial advisor, wealth manager, broker, financial planner | compliance officer, supervision principal, BSA/AML officer, registered principal |
| insurance | insurance agent, producer, account executive | compliance officer, licensing/compliance analyst, market conduct |
| healthcare | patient scheduler, patient access rep, telehealth coordinator | compliance officer, HIPAA privacy officer, health information manager |

Open rubric question for the [K] review: healthcare's reading of "revenue-generating" — the
table treats appointment-driving roles (scheduling, patient access, telehealth) as the
revenue front line of a provider org, which is a looser reading than finance/insurance sales
roles. Insurance dropped claims adjusters and agency CSRs from v1: customer-facing but not
revenue-generating.

**Strengtheners** (raise a weak match to strong, or feature in the rationale): multiple
simultaneous revenue-role openings; compliance hiring concurrent with the revenue roles
(*growing* beats *active*).

**Exclusions:** companies in the competitor registry (matched by name and aliases), and
companies inside the alert cooldown (see state below).

## Data source

**TheirStack** job-postings API — a new approved service for this branch only (amends the
main spec's non-goal capping services at Firecrawl / TurboPuffer / GitHub / Anthropic /
Voyage). Chosen 2026-08-05 over JSearch, Adzuna, and Coresignal: purpose-built for
hiring-signal prospecting, cross-source deduplication built in (postings appear 3–5× across
boards), company firmographic filters (industry, employee count), and a self-serve free tier
to validate coverage before paying.

- **Endpoint use:** the job-search endpoint only, three query shapes: (a) current-window
  revenue-role postings — role-title group × US × remote/hybrid × ≥500 employees × vertical
  industry filters; (b) current-window compliance-role postings, same filters minus
  remote/hybrid; (c) per-candidate historical compliance check — compliance titles filtered
  to one company domain over the trailing window, run only for revenue-match companies
  without current compliance postings, result cached on the company's `prospects` record so
  it is never re-bought. Postings are grouped by company client-side; the company-lookup
  endpoint costs 3 credits per record versus 1 for jobs and adds nothing we can't derive
  from the postings.
- **Credits:** free tier is 200 job records/month. The 500-employee floor cuts posting
  volume sharply, and historical checks cost ~0–5 records per *new* candidate company only,
  so the weekly three-vertical pilot is expected to fit — the pilot verifies this. The
  $59/month plan buys ~1,500 records/month with credits valid a year. [K] decides on paying
  only after the pilot gate.
- **Secret:** `THEIRSTACK_API_KEY` in GitHub repository secrets, documented in
  `.env.example`. [K] provisions the account.

## Architecture

One new pipeline and one new workflow, alongside — not through — pipeline P. P is item-shaped
(classify one document); this branch is company-shaped (score a set of postings), so it
shares P's conventions (idempotence, failure posting, thin YAML) but none of its stages. No
Voyage embeddings: matching here is exact (company domain) not semantic.

**Prospect pipeline (library under `src/prospects/`).** Per scheduled run, per vertical:

1. Query TheirStack for current-window postings (start: 30 days): the vertical's revenue
   roles (remote/hybrid, ≥500 employees) and, separately, its compliance roles (same
   filters minus remote/hybrid).
2. Group postings by company domain.
3. Drop companies matching the competitor registry (name/aliases) and companies inside the
   cooldown window in the `prospects` namespace.
4. Establish compliance evidence per revenue-match company: current compliance postings →
   *growing*; otherwise one company-filtered historical query over the trailing window
   (start: 18 months) → any hit is *active*; no hit is *none*. Evidence and check date are
   cached on the company's `prospects` record — re-runs and later scans reuse it instead of
   re-querying.
5. For each revenue-match company with evidence *growing* or *active*: one Claude call
   scores the posting set against the vertical rubric — `strong` / `weak` / `none`, a
   why-now rationale, and the evidence postings. (Companies with evidence *none* are
   recorded but not scored — no LLM spend on non-signals.)
6. `strong` → post the alert and upsert the company to `prospects` with `last_alerted_at`.
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
| `compliance_evidence` | string | growing / active / none — see pipeline step 4 |
| `compliance_checked_at` | timestamp | when the historical check last ran; caches the credit spend |
| `first_seen` | timestamp | first run that surfaced the company |
| `last_evaluated_at` | timestamp | latest scoring run |
| `last_alerted_at` | timestamp | empty unless a strong alert has fired |

**Cooldown:** a company with `last_alerted_at` inside the last **90 days** is never
re-alerted, regardless of new postings — re-runs, long-lived postings, and slow-rolling
hiring plans produce one alert, not a drip.

**Tunable thresholds** (v1 starting values; changes go in `docs/tuning-log.md` with date and
reason, per house rules): 500-employee floor, 30-day current window, 18-month
active-compliance window, 90-day alert cooldown, weekly scan cadence.

## Alert format

One Slack message per strong company, posted as detected:

> 🎯 **Prospect — finance**: Meridian Wealth Partners (~650 employees, Denver CO)
> Hiring 6 remote/hybrid financial advisors while growing its compliance org (supervision
> principal posted this month) — scaling a distributed advisory team under supervision
> requirements.
> 🔗 Senior Financial Advisor (Remote) ×2 · Financial Advisor (Hybrid) ×4 · Compliance Principal

- Header: vertical + company name + size/location when TheirStack provides them.
- Body: the model's why-now rationale grounded in the postings — same grounding bar as the
  digest (claims traceable to evidence).
- Context row: each evidence posting as a named link to the original listing.
- Channel: `#intel-staging` until the quality gate; then `#intel-prospects` via the same
  single-constant promotion mechanism the alert branch uses (`ALERT_CHANNEL` pattern in
  `src/pipeline/alert.ts`). Ops posts (📭/❌) stay in staging permanently, as everywhere else.

## Gates [K]

1. **Rubric review** (before build starts): role lists per vertical (especially healthcare's
   "revenue-generating" reading — see the open question in the Signal model), the
   500-employee floor, the 18-month active-compliance window, and the strengthener list.
   ~15 minutes.
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
- **Compliance-org evidence from postings history** (Kieron/design, 2026-08-05) — the signal
  requires an active *or* growing compliance org, not strictly concurrent compliance hiring
  (the v1 concurrency model was too narrow). Postings are this branch's only data source, so
  "active" is proxied by compliance postings in the trailing 18 months via company-filtered
  queries — no new enrichment vendor.
- **Remote/hybrid required on revenue roles; 500+ employee floor** (Kieron, 2026-08-05) —
  remote/hybrid moved from strengthener to requirement; 500+ staff is the proxy for the
  ≥200 end-user minimum and is applied in the query, not post-hoc.
- **Queries in code, not registry** — structured query objects don't fit W0's form inputs;
  deploy is a git push.
- **Delivery: immediate alerts to a dedicated `#intel-prospects` channel** (Kieron,
  2026-08-05) — sales-facing buying-intent output kept separate from competitor/regulatory
  intel.
- **US only, current target verticals** (Kieron, 2026-08-05) — verticals added later reuse
  the per-vertical structure.
