# Sources — insurance vertical feed candidates (phase 4 research, not seeded)

Research output for the intel-aggregator insurance-vertical source expansion. **Nothing here is seeded.** This is a review list for Kieron: pick the `seed-now` rows, then add them to `src/registry/seed.ts` and re-export (never edit `docs/sources-v1.md` directly).

The insurance digest wants **regulatory news that touches communications compliance in insurance**: TCPA/telemarketing enforcement against insurers and agencies, call-recording/retention rules for insurance sales, state DOI enforcement of sales conduct and consumer contact, NAIC model rules on consumer communications, annuity/life best-interest sales-conduct rules, and robocall/lead-generation actions in insurance distribution. General insurance industry news (M&A, catastrophe losses, rate filings, coverage-litigation) is **noise**. The hard finding of this round: **there is almost no open RSS that is pure comms-compliance-in-insurance.** That signal is scattered across (a) broad trade-press firehoses that need aggressive relevance gating, and (b) law-firm topical feeds — several of which are WAF/Cloudflare-gated against automated clients. TCPAWorld (already seeded in finance) is arguably the densest existing net for the insurance lead-gen/robocall angle.

## Recommendation (agent summary)

Only two rows are verifiable-and-on-topic enough to seed today — **National Law Review Insurance (`seed-now`, tag commentary)** as the regulatory/sales-conduct net, and optionally **Insurance Journal (`maybe`)** as a high-volume broad net behind an aggressive relevance gate. The single highest-potential source, **JD Supra Insurance** (+ its Privacy/ConsumerProtection siblings), is blocked from this sandbox (503) — worth a one-off verification from a browser or a GitHub Actions run before seeding, since that is where the DOI-enforcement, call-recording, and TCPA-in-insurance law-firm alerts actually concentrate. Everything else with real comms-compliance density is WAF/captcha-gated and belongs in the W2 crawl queue, led by InsuranceNewsNet and the NAIC Newsroom.

## How every candidate was verified

Each feed URL was fetched with `curl -sL -A "Aggie Intel research@spokephone.com" --max-time 20 <url>` and, where blocked, retried with a browser UA. "Verified" means HTTP 200 with an RSS/Atom root element and parseable items. Volume is estimated from the date spread of the returned window. Recent-item titles were inspected to judge whether comms-compliance stories genuinely appear.

**Environment caveat:** several law-firm/trade hosts sit behind Cloudflare/Radware/nginx bot-protection returning 403/000/captcha to automated clients (InsuranceNewsNet, PropertyCasualty360, ThinkAdvisor, NY DFS, Carlton Fields, AM Best, LexBlog-hosted firm blogs). **JD Supra's `feed.aspx` endpoint returned HTTP 503 to every client tried** from this sandbox, though the feed-URL format is confirmed valid from JD Supra's own RSS index. A GitHub Actions run (different egress) may reach some of these. Anything that could not be fetched end-to-end is never rated `seed-now`.

### Legend

- **Class:** `primary` (regulator itself) · `trade-press news` (reporting outlet) · `commentary` (law-firm/analyst) · `vendor` (company blog).
- **Tier:** `seed-now` (verified, on-topic, add it) · `maybe` (works but caveated — volume, overlap, thin comms density, or unverifiable) · `skip` (dead, gated, off-topic, or duplicative).
- **Verified:** what the fetch returned (HTTP / root / item count / newest item seen).

---

## Bucket 1 — Primary regulators (NAIC, state DOIs)

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| NAIC — Newsroom | none | no public RSS — `content.naic.org/*.xml` all 404; only a Confluence staff-wiki feed-builder and an email-only "NewsWire" clipping service exist | n/a | primary | skip (→ crawl) | The canonical insurance-regulator source (model rules on consumer communications, market-conduct, best-interest). No open feed. High-value W2 crawl target: `https://content.naic.org/newsroom`. |
| NY DFS — Press releases | `https://www.dfs.ny.gov/reports_and_publications/press_releases/feed` | 403 (WAF, both UAs) | n/a | primary | skip (→ crawl) | DFS enforcement (incl. insurance producer/sales conduct, cybersecurity/consumer-data reg 500) is on-topic. WAF-gated. Crawl target. |
| CA DOI — Press releases | `https://www.insurance.ca.gov/0400-news/0100-press-releases/rss.cfm` | 200 but returns HTML (no feed served) | n/a | primary | skip (→ crawl) | `.cfm` path is live but serves the HTML page, not XML. CA DOI enforcement of sales/marketing conduct is on-topic. Crawl target. |
| TX TDI — News | `https://www.tdi.texas.gov/rss/news.xml` (404); `https://www.tdi.texas.gov/news/` (200 HTML) | 404 XML / HTML page only | n/a | primary | skip (→ crawl) | No RSS; news is an HTML index. Crawl target. |
| FL OIR / FL CFO | `https://www.floir.com/rss/pressreleases.xml` (404); `https://www.myfloridacfo.com/.../rss.aspx` (404) | 404 | n/a | primary | skip (→ crawl) | No working feeds found. Florida is heavy on insurance-market news but comms-compliance density is low; low crawl priority. |

---

## Bucket 2 — Insurance trade press

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| Insurance Journal | `https://www.insurancejournal.com/feed/` | 200, rss, 30 items, newest 23 Jul 2026 | ~100+ (very high) | trade-press news | maybe | Real news cadence and it *does* carry DOI actions, fraud prosecutions, telematics/privacy, and producer-conduct stories — but the recent window was dominated by M&A, catastrophe, people-moves, coverage-litigation (the noise categories). Only seed with an aggressive relevance gate. `feeds.feedburner.com/InsuranceJournalNews` and `/news/feed/` are the same content. IJ also publishes narrower topic subfeeds (`/topics/<topic>/feed/`) worth exploring to cut volume. |
| Insurance Business America | `https://www.insurancebusinessmag.com/us/rss/` | 200, atom, 107 items, newest 23 Jul 2026 | ~100+ (very high) | trade-press news | maybe | Largest verified feed but a general P&C firehose (coverage disputes, broker/MGA moves, cat losses). Comms-compliance density is low. Broad-net-with-gate at best; leans skip on density grounds. |
| Claims Journal | `https://www.claimsjournal.com/feed/` | 200, rss, 15 items, newest 23 Jul 2026 | ~40–60 | trade-press news | skip | Claims-operations focus (recalls, litigation, fraud). Almost no sales/communications-compliance content. Off-angle for this digest. |
| LifeHealth.com (ADVISOR Magazine) | `https://www.lifehealth.com/feed/` | 200, rss, 9 items, newest 22 Jul 2026 | ~25–35 | trade-press news | skip | Life/annuity/retirement-planning lifestyle content, not sales-conduct regulation. Best-interest/Reg-BI stories are rare here. |
| InsuranceNewsNet | `https://insurancenewsnet.com/feed` | 403 (nginx, both UAs) | n/a | trade-press news | skip (→ crawl) | **High-value if reachable** — dense on annuity/life best-interest, Reg BI, DOL fiduciary, producer sales-conduct. Blocked from sandbox; strong W2 crawl candidate. |
| PropertyCasualty360 (ALM) | `https://www.propertycasualty360.com/feed/` | 403 (WAF, both UAs) | n/a | trade-press news | skip (→ crawl) | ALM P&C outlet, carries regulatory/compliance columns. WAF-gated. Crawl candidate (may be partly paywalled). |
| ThinkAdvisor (ALM) | `https://www.thinkadvisor.com/feed/` | 403 (WAF) | n/a | trade-press news | skip (→ crawl) | Reg BI / annuity best-interest coverage is on-topic, but blocked here and (per the finance round) its FeedBlitz feed serves an empty shell. Crawl-only at best; paywalled sections limit value. |
| AM Best News | `https://news.ambest.com/rss/rss.aspx` | Radware bot-captcha (blocked) | n/a | trade-press news | skip (→ crawl) | Rating-agency/industry news; low comms-compliance density and bot-gated. Low crawl priority. |

---

## Bucket 3 — Law-firm / commentary

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| National Law Review — Insurance, Reinsurance & Surety | `https://natlawreview.com/practice-groups/insurance/feed` | 200, rss, 10 items, newest 22 Jul 2026 | ~10–20 | commentary | **seed-now** (tag commentary) | Best *verified* on-topic net for insurance. Carries DOI/regulatory items (state claims-handling regs, reporting mandates), annuity/life (1035/PPLI, best-interest) and D&O — mixed with coverage-litigation the relevance gate should cut. Moderate volume, cheap to carry, no overlap with existing finance sources. The `?_wrapper_format=html` variant is identical. |
| JD Supra — Insurance | `https://www.jdsupra.com/legal-news/feed.aspx?ftype=Insurance` | **HTTP 503 to every client from sandbox** — URL format confirmed valid from JD Supra's RSS index (`/legal-news/rss-law-feeds.aspx`) | unknown | commentary | maybe (verify from Actions/browser) | **Most likely to be the densest comms-compliance insurance net** — JD Supra's Insurance topic aggregates exactly the DOI-enforcement / sales-conduct / TCPA-insurance law-firm alerts this digest wants. Could not confirm content (503). Never seed-now unverified; confirm from a browser or an Actions egress run, then promote. |
| JD Supra — Privacy | `https://www.jdsupra.com/legal-news/feed.aspx?ftype=Privacy` | HTTP 503 (same as above) | unknown | commentary | maybe (verify) | Consumer-data / call-recording / consent angle. Same 503 caveat; verify before seeding. |
| JD Supra — Consumer Protection | `https://www.jdsupra.com/legal-news/feed.aspx?ftype=ConsumerProtection` | HTTP 503 (same as above) | unknown | commentary | maybe (verify) | TCPA/telemarketing/robocall enforcement lands here. Same 503 caveat. Overlaps TCPAWorld; verify before seeding to avoid redundancy. |
| Troutman Pepper Locke — firm feed | `https://www.lockelord.com/rss` | 200, rss, 10 items, newest 23 Jul 2026 | ~40–70 | commentary | skip | Resolves to the merged Troutman firm-wide feed: galas, recognitions, all practice areas. Too broad and marketing-heavy. The useful Troutman signal (TCPA/insurance lead-gen) already comes through TCPAWorld. |
| Carlton Fields | `https://www.carltonfields.com/insights/...rss` | 403 (Cloudflare, both UAs) | n/a | commentary | skip (→ crawl) | Runs a well-known TCPA class-action tracker with heavy insurance lead-gen coverage — on-topic — but Cloudflare-gated. Crawl candidate. |
| LexBlog-hosted firm blogs (Consumer Finance Monitor, Consumer Privacy World, etc.) | various `/feed/` | 403 (LexBlog/Cloudflare browser-check) | n/a | commentary | skip (→ crawl) | LexBlog network gates automated feed fetches. Relevant for TCPA/consent but not feed-ingestible from here. |

---

## Crawl-only candidates (feedless or gated — W2 change-tracking entries)

Ranked by comms-compliance value to the insurance vertical:

1. **InsuranceNewsNet** — `https://insurancenewsnet.com/` (403 nginx). Densest trade source for annuity/life best-interest, Reg BI, DOL, producer sales-conduct. Top crawl priority.
2. **NAIC Newsroom** — `https://content.naic.org/newsroom` (no public RSS). Model rules on consumer communications, market-conduct, best-interest model #275. Primary-source anchor.
3. **JD Supra Insurance/Privacy/ConsumerProtection** — if the Actions-egress fetch of `feed.aspx?ftype=Insurance` still 503s, crawl the topic landing pages (`jdsupra.com/law-news/insurance-law/`, `/topics/insurance-regulations/`).
4. **Carlton Fields insights / TCPA tracker** — `https://www.carltonfields.com/insights` (Cloudflare). Insurance lead-gen TCPA litigation.
5. **NY DFS press releases** — `https://www.dfs.ny.gov/reports_and_publications/press_releases` (WAF). Producer conduct, Reg 500 consumer-data.
6. **CA DOI press releases** — `https://www.insurance.ca.gov/0400-news/0100-press-releases/` (HTML only). Sales/marketing-conduct enforcement.
7. **TX TDI news** — `https://www.tdi.texas.gov/news/` (HTML only).
8. **PropertyCasualty360 / ThinkAdvisor (ALM)** — WAF-gated; regulatory columns useful but partly paywalled.
