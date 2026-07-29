# Sources v5 — Firecrawl search queries (phase 4, seeded 2026-07-29)

Round 5 adds a **search modality**: the first insurance/healthcare weekly cycle showed the feeds
alone under-cover those verticals (insurance: ~85 items in-window, 0 relevant — confirmed by a
manual keyword scan of the same feeds; the vertical's best publishers are WAF-gated or feedless).
Searches fill the gap between "sources we watch" and "stories published anywhere".

## Why Firecrawl search (not Google News RSS)

- Returns **real publisher URLs**; Google News RSS returns Google-redirect links (undecodable
  since 2024) that would break canonical URLs, URL dedupe, and digest links.
- Firecrawl is already in the spec's approved service set; Google News RSS is an unofficial
  endpoint Google actively obstructs.
- Cost: **2 credits per 10 results**, no scraping (v1 classifies on title + snippet). Six queries
  weekly ≈ 12 credits/week.

## Mechanics

- `SourceKind.Search` registry rows; the `url` field carries the query. Managed via W0
  (`kind=search`) like any source.
- Runs in the Saturday W2 job (`runSearchStage` in `src/cli/crawl.ts`): news + web categories,
  10 results per query per category. News results are date-filtered to 14 days client-side
  (`tbs` doesn't apply to news; undated results dropped rather than stamped fresh). Web results
  use `tbs=qdr:w` (past week, API-side) and are stamped with the run date since they carry no
  date — this catches law-firm/regulator posts that news indexing misses. Everything is
  seen-URL filtered, then flows through the normal P pipeline (classify → embed → dedupe →
  upsert). The first run showed why the recency machinery matters: 42 of 52 news results were
  older than the window (news search ranks by relevance, not date).
- Search-found stories dedupe against feed/crawl items via the existing embedding layer, so a
  story arriving from both a feed and a search merges normally.

## Seeded queries

| Vertical | Name | Query |
|---|---|---|
| insurance | Search: insurance TCPA/telemarketing | `insurance TCPA telemarketing enforcement lawsuit` |
| insurance | Search: insurance call recording | `insurance call recording consent regulation` |
| insurance | Search: NAIC market conduct | `NAIC market conduct insurance regulation enforcement` |
| healthcare | Search: HIPAA patient communications | `HIPAA enforcement patient communications texting` |
| healthcare | Search: telehealth TCPA | `telehealth healthcare TCPA robocall enforcement` |
| healthcare | Search: healthcare call center compliance | `hospital healthcare call center HIPAA compliance violation` |

Queries are cheap to tune — edit the seed (or add via W0) and the next Saturday run picks them
up. If recall is poor, options in order: broaden queries, raise the per-query result limit, add
`web`-source results, or scrape unseen results for full content (+1 credit each).
