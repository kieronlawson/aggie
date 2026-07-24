# Sources — healthcare vertical feed candidates (phase 4 research, not seeded)

Research output for the healthcare vertical of the intel aggregator. **Nothing here is seeded.** This is a review list for Kieron: pick the `seed-now` rows, then add them to `src/registry/seed.ts` and re-export (never edit `docs/sources-v1.md` directly).

The healthcare digest should surface **regulatory news that touches communications compliance in healthcare**: HIPAA enforcement around patient communications (HHS OCR), texting/SMS patient outreach, TCPA actions against providers/telehealth, call-recording and consent in patient contact centers, telehealth communications compliance, robocall enforcement in healthcare marketing, and 42 CFR Part 2 where it touches communications. General healthcare news (payer M&A, drug pricing, ACA, clinical trials, reimbursement) is **noise** — the strongest picks below are dense in the compliance/communications angle; the broad trade-press feeds are carried only with a hard relevance gate.

## Recommendation (agent summary)

Clear `seed-now` picks are **HIPAA Journal** (trade press, densest on-topic) and **JD Supra HIPAA topic** (commentary, aggregates the firms). Everything else is a gated `maybe` (Healthcare Dive/Fierce, JD Supra Telehealth/TCPA, NatLawReview healthcare, HIPAA Pulse) or blocked/dead. The single highest-value healthcare-comms source — **HHS OCR's newsroom** — has no feed and must be a W2 crawl target, along with the OCR breach portal. All `*.hhs.gov` hosts returned HTTP 000 from this sandbox (same egress limit as FCC), so OIG needs re-verification from the Actions runner before it could ever be seeded.

## How every candidate was verified

Each feed URL was fetched with `curl` using the Aggie declared-contact UA (`Aggie Intel research@spokephone.com`) and, where blocked, retried with a browser UA. "Verified" means the URL returned HTTP 200 with an RSS/Atom root element and parseable `<item>`/`<entry>` elements. Volume is estimated from the date spread of the returned window. Recent item titles were inspected to judge whether comms-compliance stories genuinely appear.

**Environment caveat:** every `*.hhs.gov` host (OCR, OIG) returned HTTP 000 (connection failure) from this sandbox — the same egress limitation that blocked `www.fcc.gov` in the finance round. Several health-media hosts (HealthITSecurity, mHealthIntelligence, Healthcare IT News) sit behind Cloudflare and return 403 "Just a moment…" to every UA. Those are flagged per-row and never rated `seed-now`; a GitHub Actions run (different egress) may reach the `.gov` ones.

### Legend

- **Class:** `primary` (the regulator itself) · `trade-press news` (reporting outlet) · `commentary` (law-firm/analyst opinion) · `vendor` (company blog/aggregator).
- **Tier:** `seed-now` (verified, on-topic, add it) · `maybe` (works but caveated — volume, overlap, or partial relevance) · `skip` (dead, gated, off-topic, or duplicative).
- **Verified:** what the fetch returned (HTTP / root / item count / newest item seen).

---

## Bucket 1 — Primary regulators (HHS OCR, OIG, FTC, state AG)

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| HHS OIG — What's New | `https://oig.hhs.gov/rss/whatsnew.xml` | **Unverifiable from sandbox** — HTTP 000 (connection failure) on every attempt, declared-contact and browser UA | n/a | primary | maybe (verify from Actions egress) | A real OIG RSS URL; unreachable here for the same reason `www.fcc.gov` was. Carries enforcement actions / fraud settlements. Confirm from the Actions runner before seeding; if it also 000s there, fall back to the crawl candidate below. |
| HHS OCR — News Releases & Bulletins | HTML only — `https://www.hhs.gov/ocr/newsroom/index.html` (no RSS); `https://www.hhs.gov/about/news/rss/press-releases.rss` → 403 | no feed | n/a | primary | skip (→ crawl) | **The single most on-topic primary source** (HIPAA settlements over patient-comms breaches, ransomware Security Rule resolutions, the new 42 CFR Part 2 civil enforcement program). No RSS exists; newsroom is a plain HTML list. Pursue as a W2 crawl target. |
| HHS OCR — Breach Portal ("wall of shame") | `https://ocrportal.hhs.gov/ocr/breach/breach_report.jsf` | HTML/JSF, no feed | n/a | primary | skip (→ crawl) | Structured list of breaches ≥500 individuals incl. Part 2 records. High signal but JSF form, not feed-ingestible. Crawl candidate. |
| FTC — Press Releases | `https://www.ftc.gov/feeds/press-release.xml` | (verified in finance round: 200, rss) | — | primary | skip (duplicate) | Healthcare-privacy actions (GoodRx, BetterHelp-style data-sharing / telehealth-marketing cases) arrive through the **existing FTC feed already seeded in the finance bucket** — do not add a second FTC row. Rely on the healthcare relevance gate to route those items into this vertical. |
| State AG healthcare-privacy actions | — | no unified feed | n/a | primary | skip (→ crawl) | 50 separate AG sites, mostly HTML press pages, no aggregate feed. Not feed-ingestible; revisit as targeted crawls if a specific AG (e.g. CA, TX) proves high-value. |

---

## Bucket 2 — Healthcare trade press

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| HIPAA Journal | `https://www.hipaajournal.com/feed/` | 200, rss, 10 items, newest 23 Jul 2026 | ~15–25 | trade-press news | **seed-now** | **Strongest healthcare-comms pick.** Every item is HIPAA/breach/OCR-enforcement focused: recent titles include insider data breaches, phishing exposing patient data, 15M-record breach notifications, OCR settlements. Dense in the patient-communications / PHI-exposure angle Spoke cares about. Publishes as WordPress RSS. |
| Healthcare Dive | `https://www.healthcaredive.com/feeds/news/` | 200, rss, 10 items, all 23 Jul 2026 | ~30–40 | trade-press news | maybe | Real news cadence but general (payer/ACA, CMS reimbursement, AI scribes, M&A). Comms-compliance is a small minority of output — seed only behind a hard relevance gate, otherwise pure noise for this vertical. |
| Fierce Healthcare | `https://www.fiercehealthcare.com/rss/xml` | 200, rss, 25 items, spread 21–23 Jul 2026 | ~30–50 | trade-press news | maybe | Same profile as Healthcare Dive: high volume, mostly payer/ACA/340B/AI-funding. Overlaps Healthcare Dive heavily. If a broad trade feed is wanted, seed **one** of the two (prefer Healthcare Dive's cleaner news feed), not both. |
| Becker's Hospital Review | `https://www.beckershospitalreview.com/feed/` | 200, rss, 10 items, newest 24 Jul 2026 | ~50+ | trade-press news | skip | Very high volume, overwhelmingly hospital-operations/finance/leadership. Comms-compliance density too low to justify the noise even with a gate. (Becker's separate Health-IT/cybersecurity subfeeds — `beckershealthit.com/feed`, `/rss/cybersecurity.xml` — are dead: empty 114-byte stub / 404 after site consolidation.) |
| HealthITSecurity (TechTarget) | `https://healthitsecurity.com/feed` (403 Cloudflare); successor `https://www.techtarget.com/healthtechsecurity/rss/xtelligent-Healthtech-Security-feed.xml` (200 but newest item Sep 2025, glossary "What is…" evergreens only) | blocked / stale | n/a | trade-press news | skip | Was the best healthcare-security news feed, but the brand was folded into Informa TechTarget (Sept 2025) and the news feed is defunct — the live successor feed serves only evergreen glossary definitions, no dated news. Dead for our purposes. |
| mHealthIntelligence | `https://mhealthintelligence.com/feed` | 403 (Cloudflare "Just a moment…"), both UAs | n/a | trade-press news | skip | Same Informa/TechTarget consolidation; telehealth brand no longer maintains a working news feed. |
| Healthcare IT News | `https://www.healthcareitnews.com/home/feed` | 403 (Cloudflare "Just a moment…"), both UAs | n/a | trade-press news | skip (→ crawl) | Cloudflare-gated to automated clients. Carries HIPAA/interoperability/breach coverage — worth a W2 crawl attempt from Actions egress. |

---

## Bucket 3 — Law-firm / commentary

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| JD Supra — HIPAA topic | `https://www.jdsupra.com/topics/hipaa_rss/` | 200, rss, 50 items, newest 24 Jul 2026, oldest 29 May 2026 | ~6 | commentary | **seed-now** (tag commentary) | Squarely on-topic: HIPAA Security Rule modifications, OCR settlements, healthcare data-privacy class actions, third-party PHI requests. Aggregates many firms' posts into one feed, so it subsumes individual firm blogs (Foley, Manatt, Sheppard) — seed this instead of chasing per-firm feeds. Tag commentary so classification weights it. |
| JD Supra — Telehealth topic | `https://www.jdsupra.com/topics/telehealth_rss/` | 200, rss, 50 items, newest 24 Jul 2026, oldest 15 May 2026 | ~6 | commentary | maybe | Telehealth compliance including some comms angles, but a lot is FDA device / Medicare RPM reimbursement / DOJ fraud — noise for us. Seed only if the HIPAA topic alone feels thin; relies on the relevance gate. |
| JD Supra — TCPA topic | `https://www.jdsupra.com/topics/tcpa_rss/` | 200, rss, 50 items, newest 24 Jul 2026, oldest 24 Jun 2026 | ~12 | commentary | maybe | On-topic for robocall/text consent, but **heavily overlaps the finance bucket's TCPAWorld and NatLawReview Communications feeds** (same 7th-Cir. "texts are not calls" story appears in all three). Skip unless you want a healthcare-tagged TCPA net specifically; otherwise the finance TCPA sources already cover it. |
| National Law Review — Healthcare practice group | `https://natlawreview.com/practice-groups/healthcare/feed` | 200, rss, 10 items, spread 21–23 Jul 2026 | ~20–30 | commentary | maybe | Fast cadence but broad health law (340B, FDA enforcement, APRN scope, AI legislation, telehealth). HIPAA/comms items are a minority and overlap JD Supra HIPAA. Adds to the commentary skew — seed only as a second net, and gate hard. |
| HIPAA Pulse (Patient Protect) | `https://hipaapulse.com/feed.xml` | 200, rss, 34 items, spread 13–23 Jul 2026 | ~20 | vendor | maybe | Curated aggregator of OCR enforcement / breach-portal / state-AG / FTC / CISA items — on paper the ideal healthcare-comms firehose. In practice the recent window skewed to generic ransomware/cyber-threat news (Iranian OT actors, extortion surveys) over patient-comms compliance, and it's a vendor product (occasional Patient Protect promo). Seed only with dedupe + relevance gating; watch for marketing items. |
| Foley "Health Care Law Today" / Manatt Health / Sheppard Health Law | per-firm blogs | not separately verified | n/a | commentary | skip (covered) | These firms syndicate into JD Supra's HIPAA/telehealth topic feeds and NatLawReview's healthcare feed above. Per the finance round's lesson, don't add individual firm blogs that a topic aggregator already carries — pure commentary-skew duplication. |

---

## Future crawl candidates (feedless but valuable — W2 change-tracking entries)

- **HHS OCR News Releases & Bulletins** — `https://www.hhs.gov/ocr/newsroom/index.html` (no RSS; the highest-value healthcare-comms primary source — HIPAA settlements, ransomware Security Rule resolutions, 42 CFR Part 2 enforcement).
- **HHS OCR Breach Portal** — `https://ocrportal.hhs.gov/ocr/breach/breach_report.jsf` (structured ≥500-record breach list incl. Part 2; JSF form, not a feed).
- **HHS OIG — What's New** — `https://oig.hhs.gov/rss/whatsnew.xml` (real RSS but 000 from this sandbox; crawl the enforcement/newsroom pages if the Actions-egress fetch also fails).
- **Healthcare IT News** — `https://www.healthcareitnews.com` (Cloudflare-gated feed; HIPAA/interoperability/breach coverage).
- **State AG healthcare-privacy pages** — no aggregate feed; targeted crawls of specific AGs (e.g. CA, TX, NY) if they prove high-value.
