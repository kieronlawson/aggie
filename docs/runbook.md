# Aggie runbook

Aggie has no moving parts beyond a GitHub repo, GitHub Actions, TurboPuffer, Firecrawl, and the
Anthropic + Voyage + Slack APIs. Everything below is done from the **Actions** tab or by editing
the registry through the W0 workflow. There is no server to log into.

## The workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `verify` | manual | One authenticated call per service, creates the TurboPuffer namespaces, posts a line to `#intel-staging`. Run after rotating any secret. |
| `w0-registry` | manual | Add/edit competitors and sources, seed, or export the registry. |
| `w1-ingest` | daily 02:00 UTC + manual | Feeds and (weekly) job boards → P pipeline. |
| `w2-crawl` | Fri 03:00 UTC + manual | Firecrawl change-tracking on the crawl sources → P pipeline. |
| `w3-report` | Sun 06:00 UTC + manual | One digest per vertical to Slack, upserts to the `reports` namespace. |
| `ci` | every push | lint + typecheck + unit tests. |

## Adding a source

1. Actions → **w0-registry** → *Run workflow*.
2. `action: add_source`. Fill `kind` (feed / job_board / crawl), `url`, `vertical`, and — for a
   competitor source — `competitor` (must already exist; a typo is rejected) and `cadence`.
3. Run. The confirmation posts to `#intel-staging`. No deploy, no code change.

## Adding a competitor

`action: add_competitor` with `name`, `relationship` (displace / partner), and comma-separated
`aliases`. Add the competitor **before** any source that references it.

## Disabling a source

`action: disable_source` with the source `url`. It stays in the registry (audit trail) but is
skipped by W1/W2/W3.

## Reading the failure footer

Every run posts its own failures to `#intel-staging` with the source URL and the error. The weekly
digest carries a **Source health** footer listing sources that failed or returned nothing that
week. A source that fails one day self-heals the next run (ingestion is idempotent — the seen-URL
check means re-running is always safe).

## Rotating a secret

1. Repo → Settings → Secrets and variables → Actions → update the secret
   (`ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `TURBOPUFFER_API_KEY`, `FIRECRAWL_API_KEY`,
   `SLACK_BOT_TOKEN`).
2. Run **verify** to confirm the new key works end-to-end.

## Non-secret configuration (repo → Settings → Variables)

| Variable | Meaning |
|---|---|
| `TURBOPUFFER_REGION` | Region host prefix, e.g. `gcp-us-east4`. |
| `OUTPUT_STAGE` | `staging` routes everything to `#intel-staging`; `production` routes digests to `#intel-digest` and alerts to `#competitive-intel`. Flip to `production` at the phase-3 gate. |
| `DEDUPE_CANDIDATE_THRESHOLD` | Embedding similarity above which a Haiku compare runs (default 0.90). |
| `ALERT_SENTIMENT_THRESHOLD` | Minimum complaint sentiment that fires an alert (default `moderate`). |

## Running an entrypoint locally

```sh
cp .env.example .env   # fill in the keys
set -a; source .env; set +a
npm ci
npm run verify         # or: ingest / crawl / report / registry
```

`INPUT_*` env vars drive the registry and ingest entrypoints locally the same way the
`workflow_dispatch` inputs do in Actions (e.g. `INPUT_ACTION=export npm run registry`).

## Kill switch

Actions tab → each workflow → **⋯ → Disable workflow**. Disabling `w1-ingest`, `w2-crawl`, and
`w3-report` stops all data flow and delivery immediately. The registry and stored items are
untouched; re-enable to resume.
