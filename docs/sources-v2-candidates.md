# Sources v2 — feed candidates (research, not seeded)

Research output for the intel-aggregator source expansion. **Nothing here is seeded.** This is a
review list for Kieron: pick the `seed-now` rows, then add them to `src/registry/seed.ts` and
re-export (never edit `docs/sources-v1.md` directly).

## Why this exists — the skew problem

The current finance feed set leans on law-firm commentary (JD Supra Securities Law, JD Supra
Finance & Banking) and vendor thought-leadership (Global Relay blog). That biases the pipeline
toward secondary opinion pieces and marketing content rather than **what actually happened**. This
list hunts for two things that are under-represented today:

1. **Primary sources** — the regulators themselves (FCC, CFPB, OCC, Federal Reserve, FTC), where
   enforcement actions and rules originate.
2. **Genuine trade-press news** — outlets that report events (Banking Dive, Compliance Week) rather
   than publish billable-hour analysis of them.

Competitor and TCPA/telecom buckets are included per the brief. Commentary sources are still listed
(some are the single densest source of robocall/off-channel news) but are tagged so classification
can weight them accordingly.

## How every candidate was verified

Each feed URL was fetched with `curl` using the Aggie declared-contact UA
(`Aggie Intel research@spokephone.com`) and, where that was blocked, a browser UA. "Verified" means
the URL returned HTTP 200 with an RSS/Atom root element (`<rss>`/`<feed>`) and parseable `<item>`/
`<entry>` elements. Volume is estimated from the date spread of the returned window (a 10-item
window all dated one day ⇒ high volume). Recent-item titles were inspected to judge whether
comms-compliance stories genuinely appear.

**Environment caveat:** `www.fcc.gov` returned HTTP 000 (connection failure) for every request from
this sandbox, and several IR/vendor hosts sit behind WAFs (Cloudflare/Vercel) that return 403/429 to
automated clients. Those are flagged per-row; a GitHub Actions run (different egress) may reach some
of them. Anything I could not fetch end-to-end is marked accordingly and never rated `seed-now`.

### Legend

- **Class:** `primary` (the regulator/company itself) · `trade-press news` (reporting outlet) ·
  `commentary` (law-firm/analyst opinion) · `vendor` (company blog/marketing).
- **Tier:** `seed-now` (verified, on-topic, add it) · `maybe` (works but caveated — volume, overlap,
  or partial relevance) · `skip` (dead, gated, off-topic, or duplicative).
- **Verified:** what the fetch returned (HTTP / root / item count / newest item seen).

---

## Bucket 1 — US federal primary regulators

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| CFPB Newsroom | `https://www.consumerfinance.gov/about-us/newsroom/feed/` | 200, rss, 19 items, newest 25 Jun 2026 | ~3–5 | primary | **seed-now** | WordPress feed. Consent orders / enforcement / rulemaking. Directly on-topic (recordkeeping, consumer-comms, debt-collection call rules). |
| Federal Reserve — Enforcement Actions | `https://www.federalreserve.gov/feeds/press_enforcement.xml` | 200, rss, 15 items | ~1–3 | primary | **seed-now** | Pure enforcement-action stream. Low volume, high signal. Content-type `text/xml`. |
| Federal Reserve — All press releases | `https://www.federalreserve.gov/feeds/press_all.xml` | 200, rss, 20 items | ~5–8 | primary | maybe | Superset of the enforcement feed. Seed the enforcement one instead unless you want monetary-policy/supervision noise too. |
| OCC — News Releases | `https://www.occ.gov/rss/occ_news.xml` | 200, rss, 10 items, newest 19 Jul 2026 | ~1–3 | primary | **seed-now** | OCC publishes monthly enforcement-action roundups **as news releases**, so this feed captures them; also interagency statements. No separate enforcement RSS exists (confirmed on OCC's RSS index). Host is `occ.gov` (not `occ.treas.gov` — that 404s). |
| FTC — Press Releases | `https://www.ftc.gov/feeds/press-release.xml` | 200, rss, 10 items, newest 15 Jul 2026 | ~5–10 | primary | **seed-now** | Telemarketing/TSR & robocall actions live here, **but** they are a minority of FTC output (recent window was mostly advertising/antitrust/FCRA). Relevance gate is essential or it adds noise. Note: `ftc.gov/news-events/news/rss` 404s — use this `/feeds/` path. |
| FCC — Daily Digest, Enforcement Bureau, Consumer & Governmental Affairs Bureau | Listed on `https://www.fcc.gov/news-events/rss-feeds-and-email-updates-fcc` (per-bureau feeds) | **Unverifiable from sandbox** — `www.fcc.gov` returned HTTP 000 on every attempt; `apps.fcc.gov` returned 403 | n/a | primary | skip | **Kieron reviewed the feed content 2026-07-20: nothing materially useful — skip.** (Original note: robocall/TCPA fines, DNC, spoofing looked high-value on paper, but the feed content didn't bear that out.) |

---

## Bucket 2 — Finance trade press

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| Compliance Week | `https://www.complianceweek.com/rss` | 200, rss, 10 items, newest 18 Jul 2026 | ~5–10 | trade-press news | **seed-now** | Strongest fix for the skew. Recent titles: SEC Marketing Rule enforcement, FCA rules, GDPR enforcement, insider-trading settlements. Off-channel/recordkeeping sweeps are recurring Compliance Week material. Note: `/rss/news` returns HTML — use bare `/rss`. |
| Banking Dive | `https://www.bankingdive.com/feeds/news/` | 200, rss, 10 items, all 17 Jul 2026 | ~20–30 | trade-press news | **seed-now** | Real news cadence (CFPB, OCC consent orders, bank supervision). Comms-compliance is adjacent rather than central (general banking), so lean on the relevance gate. High volume. |
| ThinkAdvisor | `https://feeds.feedblitz.com/ThinkAdvisor` | 200, rss root, **0 items** to every client tried (FeedBlitz returns an empty shell) | unknown | trade-press news | skip | Re-verified 2026-07-20 after it "worked in browser" for Kieron: the browser gets FeedBlitz's styled HTML view, not the feed. The raw RSS serves 0 items to every UA (declared-contact, curl, Chrome), Accept header, `?x=1`, and `.rss` variant. Not UA-spoofable; crawl-only at best (paywalled Regulation section). |
| InvestmentNews | `https://www.investmentnews.com/feed` (404); `http://feeds.feedburner.com/investmentnews-news-opinion` (200 but 0 items) | 404 / empty shell | n/a | trade-press news | skip | Site relaunched; old WordPress + FeedBurner feeds are dead shells. The Regulation section is live on-site but paywalled ($19.99/mo) with no working feed. Crawl-only at best (paywall makes it low-value). |
| Regulatory Compliance Watch (RCW) | — | not fetched | n/a | trade-press news | skip | Subscription trade newsletter, no open feed; heavily paywalled. Not feed-ingestible. |

---

## Bucket 3 — Competitor newsrooms / blogs

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| RingCentral — Blog | `https://www.ringcentral.com/blog/feed/` | 200, rss, 10 items, newest 17 Jul 2026 | ~3–7 | vendor | **seed-now** | Product/positioning content (AI, launches). Good for competitor-move signals. `/us/en/blog/feed/` is the same feed. |
| Twilio — Blog | `https://www.twilio.com/blog/feed` | 200, rss, 30 items | ~10–20 | vendor | maybe | Valid, high-volume, but dev/product-heavy (API tutorials). Relevance gate needed to surface comms-compliance/positioning items. `/en-us/blog/feed` is identical. |
| Theta Lake — News | `https://thetalake.com/feed/` | 200, rss, 10 items, newest 21 May 2026 | ~1–2/month | vendor | **seed-now** | Partner/competitor in comms-compliance archiving — squarely on-topic (recent item: "Theta Lake Announces Integration with the Claude Compliance API"). Low volume, so cheap to carry. `/blog/feed/` 404s — use bare `/feed/`. |
| UJET | `https://www.ujet.cx/rss.xml` | 308→rss, 233 items, newest 17 Jul 2026 — but returned 504/`text/plain` on some attempts | high (flaky) | vendor | maybe | A feed exists with recent items, but the server is inconsistent (504s, wrong content-type) and 233 items suggests a full-site feed (blog + marketing pages, not just news). Seed only with dedupe/relevance gating and tolerance for fetch failures. `/blog/feed` and `/feed` 404. |
| Aircall | none working — `blog.aircall.io/feed/` returns HTML; `/feed`, `/rss.xml` 404/301 | no valid feed | n/a | vendor | skip (→ crawl) | No usable RSS. News lives at `aircall.io/blog/news/` (crawl candidate) or syndicates via Cision (`newswire.ca/news/aircall`). |
| 8x8 — Blog / Newsroom | `https://www.8x8.com/blog/rss.xml` (429 Vercel checkpoint); IR feeds 404/000/301 | blocked | n/a | vendor | skip (→ crawl) | Blog behind Vercel bot-protection (429); no reachable newsroom/IR feed found. Crawl candidate. |
| Smarsh — Newsroom | `https://www.smarsh.com/feed`, `/blog/feed`, `/rss.xml`, `/index.xml` all 403 | blocked (WAF) | n/a | vendor | skip (→ crawl) | Every path 403s (WAF). Smarsh is a key comms-compliance archiving partner/competitor, so high value — pursue as a Firecrawl target rather than a feed. |
| RingCentral — Investor press releases | `https://ir.ringcentral.com/...` / `investors.ringcentral.com/...` | 403 (Cloudflare "Just a moment") / 000 | blocked | primary | skip (→ crawl) | Cloudflare-gated. Blog feed above already covers most competitor-move signal; press releases are a crawl candidate if IR-grade detail is wanted. |

---

## Bucket 4 — TCPA / telecom-compliance specialists

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| TCPAWorld (Troutman Amin) | `https://www.tcpaworld.com/feed/` | 200, rss, 33 items, newest 17 Jul 2026 | ~20–35 | commentary | **seed-now** (tag commentary) | The single densest source of robocall/TCPA/DNC/off-channel news — even though it's a law firm, it functions as a fast news wire (e.g. it broke the 7th Cir. "texts are not calls" ruling). High volume; tag as commentary so classification weights it. Directly on-topic for Spoke. |
| National Law Review — Communications, Media & Internet | `https://natlawreview.com/taxonomy/term/153/feed` | 200, rss, 10 items, newest 18 Jul 2026 | ~10–20 | commentary | maybe | Targeted taxonomy feed carrying TCPA/robocall articles (much of it Troutman Amin, overlapping TCPAWorld) mixed with state-privacy pieces. Overlaps existing NatLawReview coverage and adds to the commentary skew — seed only if you want a second TCPA net; otherwise TCPAWorld covers it. |
| National Law Review — Recent Contributions (firehose) | `https://natlawreview.com/recent-contributions/feed` | 200, rss, 14 items in minutes | very high (all topics) | commentary | skip | All-topics firehose (immigration, AI, etc.). Far too noisy for a comms-compliance aggregator; use the taxonomy feed above instead. |

---

## Future crawl candidates (feedless but valuable — for the W2/Firecrawl phase)

These have no usable feed (WAF-blocked, HTML-only, or paywalled) but are worth crawling later:

- **Smarsh newsroom** — `https://www.smarsh.com/news` (WAF blocks all feed paths; core comms-compliance archiving competitor/partner).
- **8x8 blog / newsroom** — `https://www.8x8.com/blog` and `https://investors.8x8.com` (Vercel/IR bot-protection).
- **Aircall news** — `https://aircall.io/blog/news/` (HTML only; press releases also via Cision `newswire.ca/news/aircall`).
- **RingCentral investor press releases** — `https://ir.ringcentral.com` (Cloudflare-gated; IR-grade detail beyond the blog).
- **FCC per-bureau feeds** — if the Actions-egress fetch still fails after confirming URLs, crawl the Daily Digest / Enforcement Bureau headline pages instead.
- **InvestmentNews Regulation section** — `https://www.investmentnews.com/regulation-legal-compliance` (live but paywalled; low priority given the paywall).

---

## Next round (planned, not started)

Kieron (2026-07-20): a keyword-focused research round follows this one — TCPA, 10DLC, DNC,
Campaign Registry (TCR), and adjacent messaging-compliance terms. Goal: sources found by
searching the topic space, not by walking known publishers.
