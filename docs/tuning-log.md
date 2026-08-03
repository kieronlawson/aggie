# Tuning log

Every change to a tuning threshold, with date and reason. Current values:

| Threshold | Where | Value |
|---|---|---|
| Dedupe candidate similarity (layer 2) | `src/pipeline/process.ts` `DEDUPE_SIMILARITY_THRESHOLD` | 0.90 |
| Alert sentiment (complaint/outage) | arrives in phase 2 | `moderate` (planned) |
| Report cluster similarity | `src/report/cluster.ts` `CLUSTER_SIMILARITY_THRESHOLD` | 0.85 |

## Changes

- 2026-07-17 — Initial values set per spec: dedupe 0.90, alert `moderate` (phase 2). Report
  cluster threshold chosen at 0.85 (below the dedupe threshold so distinct-but-related items can
  share a digest cluster without being merge candidates).

- 2026-07-17 — Added relevance gate to classification (item must touch business-communications
  compliance or a tracked competitor; report queries filter `relevant Eq true`). Reason: first
  finance digest was dominated by off-topic legal commentary (e.g. NJ data-broker registration).
  Backfill re-judged existing items: finance 12/225 relevant, competitor 35/39.

- 2026-07-20 — Added `content_kind` news/evergreen to the classifier; evergreen items excluded
  from digest stories, surfaced once in "Worth a read". Reason: evergreen vendor content (Global
  Relay) recurring as pseudo-news in continuing stories.

- 2026-07-29 — Added a North American market scope to the relevance gate: items whose impact is
  confined to non-NA markets are relevant=false even when they otherwise match (Kieron, after
  the 2026-07-26 competitor digest led sales talking points with a France-only Twilio carrier
  maintenance and an insurance item cited the Italian Council of State). Global-reach and
  US/Canada-impact items stay relevant. Stored items re-judged via the relevance backfill.

- 2026-08-03 — Added a `vertical` output to the classifier and routing in `processRawItem`:
  items are stored under the vertical the story is *about*, not the vertical of the source that
  fetched them. Competitor-sourced items stay competitor; generic stories (vertical=none) stay
  with the source that found them (Kieron's call — accepted that generic TCPA stories keep
  appearing in more than one digest). Reason: the 2026-08-02 healthcare digest carried a
  California mortgage-lender TCPA suit, and finance carried AdaptHealth/Health Choice Now
  (healthcare) stories. Seen-URL checks became a union across all item namespaces so routed
  items stay idempotent.

- 2026-08-03 — Tightened the relevance gate against self-promotional content: law-firm case-win
  posts, firm news (podcast/webinar/studio announcements), vendor marketing, and
  content-marketing explainers are relevant=false even when on-topic. Reason: the 2026-08-02
  finance digest included a podcast studio-format announcement and a law-firm settlement promo;
  8 of its 16 stories came from tcpaworld.com.
