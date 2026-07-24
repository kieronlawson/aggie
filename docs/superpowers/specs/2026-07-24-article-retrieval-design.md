# Article retrieval — feed enrichment + crawl index expansion: design

Date: 2026-07-24
Status: draft — awaiting Kieron's review (spec only; no build yet, another agent is active in the repo)

## Problem

Everything Aggie publishes must be credible, and credibility is capped by the text the pipeline
actually analyses. Today that text is whatever the source hands us, and it is often thin:

- **Feeds (W1):** items use the feed-supplied body — first non-empty of `content:encoded` →
  `content` → `summary` → `contentSnippet` → title (`src/clients/feeds.ts`). Trade-press
  WordPress feeds ship full articles (HIPAA Journal ~4,500 chars), but the primary regulator
  feeds ship one or two sentences: measured live 2026-07-24 — SEC ~250 chars, CFPB ~220, Fed
  enforcement ~130. Classification and Haiku summaries for primary sources run on that.
- **Crawl (W2):** a changed tracked page becomes ONE item whose content is the git diff + a 4k
  page excerpt, titled "<source> — page updated", linking the tracked page. Fine for leaf pages
  (pricing, release notes, status) where the change IS the content; wrong for index-style pages
  (HHS OCR newsroom, NAIC newsroom) where the change is a headline+link and the story is on the
  child page. Kieron's ruling 2026-07-24: an article title alone is NOT sufficient — new links
  on an index page must be retrieved in full.

One capability fixes both: retrieve the actual article before P runs.

## Retrieval primitive

`scrapeMarkdown(url): Promise<{ title: string; markdown: string }>` in `src/clients/firecrawl.ts`
— `POST /v2/scrape` with `{ url, formats: ["markdown"], proxy: "auto" }`; returns
`data.metadata.title` + `data.markdown`; throws on non-OK / empty markdown.

Why Firecrawl rather than plain fetch + extraction: main-text extraction from raw HTML needs a
new dependency (readability/jsdom); Firecrawl already extracts to markdown, absorbs bot-blocked
hosts (the same WAF/Cloudflare walls the source research kept hitting), and is an approved
service. Cost: 1 credit per article. Plain `fetch` is NOT used for article bodies.

## Call site 1 — feed enrichment (W1 ingest)

1. After the seen-URL filter (fresh items only — re-runs never re-scrape), items where
   `content.trim().length < ENRICH_THRESHOLD_CHARS` (initial **600**; changes logged in
   `docs/tuning-log.md`) are enriched: `scrapeMarkdown(item.url)` → content becomes the
   markdown (truncated to the existing `NEW_PAGE_CHARS` 20k). Feed title is kept (feeds are
   authoritative for titles; scrape titles carry site chrome).
2. Enrichment failure is soft: keep the feed-supplied content, item still flows through P, ⚠️
   collected into the existing per-source failure reporting. A thin item beats a lost item.
3. Credits guard: before enriching, `remainingCredits()` must cover the enrichment count for
   this run; if not, skip ALL enrichment (items flow thin) and post one ⚠️ saying so. Ingest
   itself never blocks on enrichment.
4. Scrapes run through `sequentially` (429 lesson from the first W2 live run: never fan out
   unbounded requests against Firecrawl's req/min limit).

Volume estimate: only the thin items pay — the regulator feeds, ~5–15 fresh items/day →
~50–100 credits/week. Full-text feeds (most of trade press) never trigger it.

## Call site 2 — index expansion (W2 crawl)

1. New pure function `newSameHostLinks(diffText, pageUrl): string[]` — absolute http(s) links
   found in ADDED diff lines (markdown `[text](url)` and bare URLs), same host as the tracked
   page, deduped, capped at `MAX_EXPANDED_LINKS_PER_PAGE` (initial **10**, overflow logged —
   no silent truncation).
2. For each `changed` page: extract candidate links → seen-URL filter (existing
   `dropSeenNewItems` machinery) → `scrapeMarkdown` each → one RawItem per article:
   `url` = article URL, `title` = scraped title (fallback: link text from the diff),
   `content` = markdown truncated 20k, `published_at` = nowIso, `source`/`vertical`/
   `competitor`/`relationship` from the tracked source.
3. **Suppression rule:** if expansion yields ≥1 article item for a page, the "page updated"
   diff item for that page is NOT emitted (it would duplicate the articles). Zero new links —
   the leaf-page case (pricing, status) — keeps today's behaviour exactly.
4. Per-article scrape failure: fall back to emitting the diff item for that page (the signal is
   never lost), ⚠️ collected into the run summary.
5. Credits guard: re-check `remainingCredits()` before the expansion scrapes (batch already
   spent its credits); insufficient → no expansion this run, diff items emitted as today, ⚠️.
6. Expanded articles enter P unchanged — classify/embed/dedupe and the relevance gate decide
   what survives, same as any feed item. `new`-page baseline runs are NOT expanded (a first
   crawl of an index page would scrape its whole history; the baseline item alone suffices).

## Code changes

- `src/clients/firecrawl.ts` — `scrapeMarkdown` (shares `authHeaders`).
- `src/pipeline/enrich.ts` (new, pure + one IO fn) — `needsEnrichment(content)`,
  `enrichRawItem(item, scrape)` content assembly; constants exported.
- `src/pipeline/expand.ts` (new, pure) — `newSameHostLinks(diffText, pageUrl)`,
  `articleRawItem(opts)`.
- `src/cli/ingest.ts` — enrichment pass between seen-filter and `processRawItem`.
- `src/cli/crawl.ts` — expansion pass for changed pages; suppression rule; credits re-check.
- No workflow YAML changes; no registry schema changes (index-vs-leaf needs no flag — the
  diff's link content decides).

## Testing

Pure tests: `needsEnrichment` boundary (599/600/601), `newSameHostLinks` (markdown links, bare
URLs, off-host rejected, removed-line links ignored, cap + overflow, relative links resolved
against pageUrl), `articleRawItem` shape, suppression logic. Client test: `scrapeMarkdown`
success/HTTP-error/empty-markdown (fetch-mocked). Entrypoint passes verified by a live
dispatched run in staging, consistent with W1/W2 practice.

## Acceptance

A W1 run enriches at least one thin regulator item (its stored content visibly exceeds the feed
description), and a W2 run against a seeded index page (HHS OCR newsroom is the intended first
target) produces per-article items with real titles, bodies, and canonical URLs in the digest —
no "page updated" placeholder for pages that yielded articles. Kieron judges digest credibility
at the phase 4 review.

## Out of scope

Paywalled/login content (thin fallback is accepted); off-host links (syndication/canonical
selection already handles cross-domain duplication); retro-enriching items already stored;
per-feed enrichment config; expanding `new` baseline pages; RSS feeds that already ship full
text (threshold excludes them naturally).
