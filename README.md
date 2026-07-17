# Aggie — internal intel aggregator

Collects regulatory news and competitor intelligence for Spoke's ICP verticals and delivers one
weekly Slack digest per vertical plus immediate complaint/outage alerts. Internal tool — see
`docs/2026-07-17-intel-aggregator-spec.md` and `docs/2026-07-17-intel-aggregator-implementation-plan.md`.

The entire system is this repo. TurboPuffer holds all state, GitHub Actions is the only compute,
Firecrawl is fetch-only. Deploying is a `git push`.

## Layout

```
.github/workflows   w0-registry, w1-ingest, w2-crawl, w3-report (thin YAML shells) + verify, ci
src/clients         typed wrappers: turbopuffer, anthropic, voyage, firecrawl, slack
src/pipeline        the P library: normalize, hash, classify, embed, dedupe, alerts, feeds, jobboards
src/report          cluster, summarize, synthesize, format, reports store
src/registry        competitor/source records, seed list, markdown export
src/cli             one entrypoint per workflow: verify, ingest, crawl, report, registry
test                unit tests + recorded fixtures (syndicated pairs, feeds)
docs                spec, plan, sources-v1, runbook, tuning-log
```

## Development

```sh
npm ci
npm run lint && npm run typecheck && npm test
```

Operations (adding sources, rotating secrets, the kill switch): `docs/runbook.md`.
