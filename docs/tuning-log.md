# Tuning log

Every change to a tuning threshold, with date and reason. Current values:

| Threshold | Where | Value |
|---|---|---|
| Dedupe candidate similarity (layer 2) | `src/pipeline/process.ts` `DEDUPE_SIMILARITY_THRESHOLD` | 0.90 |
| Alert sentiment (complaint/outage) | arrives in phase 2 | `moderate` (planned) |
| Report cluster similarity | `src/report/cluster.ts` `CLUSTER_SIMILARITY_THRESHOLD` | 0.85 |
| Worth-a-read items per digest | `src/report/generate.ts` `WORTH_A_READ_CAP` | 5 |
| Details stories per digest | `src/report/generate.ts` `DETAILS_STORY_CAP` | 10 |
| News items per source domain | `src/report/generate.ts` `PER_DOMAIN_CAP` | 3 |

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

- 2026-08-03 — Added digest size caps: 5 Worth-a-read items, 10 Details stories (multi-source
  clusters ranked above one-off posts, then newest first), 3 news items per source domain.
  Reason: the 2026-08-02 healthcare digest listed 14 uncapped vendor-SEO evergreen items, and
  tcpaworld.com supplied half of finance's 16 stories. Caps apply before cluster summarization,
  so trimmed items also cost no model spend.

- 2026-08-03 — Tightened the relevance gate for competitor status and SEC sources:
  scheduled/planned maintenance notices are relevant=false (only occurred, unplanned incidents
  count, and only those may classify as `outage` — closing the 2026-07-29 amendment's
  precondition for the alert branch), and SEC filings are relevant only when they carry
  substantive business news (earnings, M&A, major strategic moves); ownership 13D/13G
  amendments, insider forms, registration statements, and administrative 8-Ks (e.g. the Item
  5.02 officer/director change) are relevant=false. Reason: Kieron flagged four noise stories in
  the 2026-08-02 competitor digest — two Twilio scheduled-maintenance clusters, a RingCentral
  13G-amendment cluster, and an 8x8 officer-change 8-K. Stored items re-judged via the
  relevance backfill.

- 2026-08-03 — Scoped the self-promotional exclusion away from tracked competitors: a (b)-list
  company's own product launches, pricing moves, and website/pricing-page changes stay relevant
  even when promotional in tone. Reason: the relevance backfill that removed the digest noise
  also dropped crawl-sourced competitor page changes (8x8 Eva chat-agent launch, Aircall chat
  widget) from a staging rehearsal — the classifier had over-applied the vendor-marketing
  exclusion, which targets third-party content, to competitor intel.

- 2026-08-03 — Synthesis prompt edits: empty Continuing-stories sections are omitted instead of
  writing "None." (blocks.ts also skips "None."-bodied sections so old stored digests repost
  cleanly), and signal bullets must end with a real markdown link or a plain source name —
  never empty parentheses. Reason: the 2026-08-02 digests posted "Continuing stories — None."
  replies, and the insurance card's signals contained bare "()" where citations belonged.
