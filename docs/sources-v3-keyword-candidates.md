# Sources v3 — keyword-focused feed candidates (research, not seeded)

Round 3 of source research for the intel aggregator, run **by keyword rather than by publisher**.
The brief: start from the topic space around **TCPA, 10DLC, DNC (Do Not Call), and The Campaign
Registry (TCR)** — plus adjacent outbound-messaging-compliance territory (A2P messaging, SMS
opt-in/consent, CTIA messaging guidelines, SHAFT content rules, the robocall mitigation database,
STIR/SHAKEN, branded calling, state mini-TCPA laws, carrier/CPaaS messaging-policy changes) — then
find *who publishes reliably on those topics* and verify their feeds. This is Spoke-core intel: Spoke
customers make and send calls and texts at scale into regulated verticals, so carrier policy shifts,
TCR fee/rule changes, FCC robocall orders, and big TCPA verdicts all directly affect them.

**Nothing here is seeded.** This is a review list for Kieron: pick the `seed-now` rows, add them to
`src/registry/seed.ts`, and re-export (never edit `docs/sources-v1.md` directly). Sources already
seeded or already reviewed-and-skipped in rounds 1–2 (TCPAWorld, National Law Review
Communications feed, JD Supra, RingCentral/Twilio/Theta Lake/Smarsh/UJET blogs, the federal
regulator feeds, the FCC RSS feeds Kieron skipped) are **not** re-proposed here.

## How every candidate was verified

Same protocol as v2. Each feed URL was fetched with `curl` using the declared-contact UA
(`Aggie Intel research@spokephone.com`), with a browser UA as fallback (noted where required).
"Verified" = HTTP 200 + an RSS/Atom root element + nonzero `<item>`/`<entry>` count. Recent titles
were inspected to confirm the **keywords actually appear in current output** — an outlet that name-drops
10DLC once a year doesn't count. Item counts and newest-item dates are from the returned window;
posts/week is estimated from the date spread. Nothing unfetchable is rated `seed-now`.

### Legend

- **Class:** `primary` (regulator / registry / carrier / standards body) · `trade-press news`
  (reporting outlet) · `commentary` (law-firm / analyst opinion) · `vendor` (company blog / marketing).
- **Tier:** `seed-now` (verified, on-topic, add it) · `maybe` (works but caveated — volume, staleness,
  overlap, or partial relevance) · `skip` (dead, gated, off-topic, or vendor-marketing).
- **Verified:** what the fetch returned (HTTP / root / item count / newest item seen).

---

## Class 1 — primary: registry & standards bodies

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| The Campaign Registry (TCR) | `https://www.campaignregistry.com/feed/` | 200, rss, 10 items, newest **7 Aug 2025** | <1 (sporadic) | primary | **seed-now** (tag primary, low-vol) | The registry itself — the authoritative voice on 10DLC/TCR fee changes and Authentication+ (recent items: "Introducing Auth+ 2.0", the Aug 2025 fee schedule). Squarely on-target for the TCR/10DLC keywords. **Caveat:** very low frequency and the newest item is ~11 months old — TCR rarely blogs, and it announces some changes only via CSP channels, so pair with the crawl candidates below. Cheap to carry; high signal when it fires. Note `…/news-and-events/feed/` returns an empty shell — use the bare `/feed/`. |
| CTIA | `https://api.ctia.org/feed/` | 200, rss, 10 items, newest 1 Jul 2026 | ~3–5 | primary | maybe | The wireless-industry standards body that publishes the **Messaging Principles & Best Practices** and the SHAFT content rules that carriers enforce for A2P. When it moves (e.g. the Oct 2025 Principles update), it's load-bearing for Spoke. **But** the feed is CTIA's general press/statements stream — mostly spectrum/auction/policy (C-Band, AWS-3), and messaging-guideline posts are a small minority. Seed only behind a strong relevance gate, or prefer crawling the Messaging Principles page (see crawl list). The on-site `/news/rss` and `/rss` paths are empty shells — the working feed is `api.ctia.org/feed/`. |

---

## Class 2 — commentary: TCPA / telecom-compliance law-firm blogs

These are law-firm blogs, but the strong ones function as fast news wires for exactly Spoke's topic
space (they broke/covered the July 2026 Seventh Circuit "texts are not calls under the DNC provision"
ruling within a day). Tag them `commentary` so classification can weight them.

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| Kelley Drye — Ad Law Access | `https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/rss` | 200, rss, 20 items, newest 15 Jul 2026 | ~5–8 | commentary | **seed-now** | Strongest new pick. Home of the **TCPA Tracker** and dense on telemarketing, DNC, state mini-TCPA, and state-AG enforcement (recent window: Seventh Circuit DNC/text ruling, autorenewal roundup, multistate settlements). Directly on-topic across TCPA + DNC + state mini-TCPA keywords, real news cadence. |
| Duane Morris — Class Action Defense | `https://blogs.duanemorris.com/classactiondefense/feed/` | 200, rss, 10 items, newest 17 Jul 2026 | ~3–5 | commentary | **seed-now** | Litigation-focused; covered the Seventh Circuit *Steidinger* DNC/text decision the day it landed. Reliable on TCPA/DNC class-action and consent rulings — the verdict/appellate side of the keyword space. Standard LexBlog `/feed/`. |
| The CommLaw Group | `https://commlawgroup.com/feed/` | 200, rss, 16 items, newest 15 Jul 2026 | ~2–4 | commentary | **seed-now** | Telecom regulatory boutique. Best new source for the **adjacent** cluster: robocall mitigation database, STIR/SHAKEN, KYC/KYUP FNPRMs, FCC Form 499, comment deadlines. This is the voice-provider-obligations angle Spoke needs and that nothing else here covers well. |
| Klein Moynihan Turco | `https://kleinmoynihan.com/feed/` | 200, rss, 10 items, newest 9 Jul 2026 | ~1–3 | commentary | maybe | Telemarketing/sweepstakes/privacy firm that does cover TCPA and DNC — but the current window skews to CIPA (California wiretap/privacy) rather than TCPA/10DLC. Seed only if you want a wider consumer-comms net; overlaps Kelley Drye on the TCPA side. |

---

## Class 3 — trade-press news

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| Receivables Info | `https://receivablesinfo.com/feed/` | 200, rss, 10 items, newest 17 Jul 2026 | ~10–15 | trade-press news | maybe | Debt-collection / accounts-receivable trade press that reports **FCC TCPA petitions, DNC, and robocall-blocking** items (it broke the May 2026 FCC-dismisses-TCPA-petitions and R.E.A.C.H./PACE story). Genuine news cadence and the collections angle is a real Spoke vertical — but most output is debt-collection ops, so a relevance gate is essential. |
| Telecompetitor | `https://www.telecompetitor.com/feed/` | 200, rss, 10 items, newest 17 Jul 2026 | ~15–20 | trade-press news | skip | Valid, high-volume telecom news — but it's broadband/BEAD/USF/infrastructure-heavy; robocall/STIR-SHAKEN appears only occasionally. Keyword density too low to justify the noise. |

---

## Class 4 — vendor blogs

| Source | Feed URL | Verified | Vol/wk (est) | Class | Tier | Notes |
|---|---|---|---|---|---|---|
| DNC.com (Contact Center Compliance) | `https://www.dnc.com/blog/rss.xml` | 200, rss, 10 items, newest 11 Jun 2026 | ~1–2 | vendor | **seed-now** (tag vendor) | The DNC-scrubbing specialist — squarely on the DNC/TCPA keywords (recent items: reassigned-numbers TCPA settlement, SAN requirements, Fifth Circuit consent decision, STIR/SHAKEN). Explanatory but timely, and co-presents Troutman's TCPA Annual Review. Low volume, cheap to carry, high topical fit. Autodiscovery link is `…/blog/rss.xml` (the `/blog/rss`, `/blog/feed` guesses 404). |
| NumHub — Learning Center | `https://numhub.com/learning-center/rss.xml` | 200, rss, 10 items, newest **1 Oct 2025** | <1 | vendor | maybe | On-topic for **branded calling / BCID / STIR-SHAKEN** (recent item: "Verizon Has Signed a Contract with BCID"). But the newest item is ~9.5 months old — the feed looks stale/abandoned. Skip unless it resumes; the topic is otherwise covered by The CommLaw Group. |
| MyTCRPlus | `https://mytcrplus.com/feed/` | 200, rss, 10 items, newest 6 Jul 2026 | ~1–2 | vendor | skip | The blog feed is pure product marketing ("From Reddit Pain to Product Solution", API guides) despite the on-topic domain. **But** their `/resources/…/carrier-policies-and-updates/` tracker pages are a genuinely useful structured carrier-policy tracker → crawl candidate, not a feed. |
| Bandwidth — Blog | `https://www.bandwidth.com/feed/` (empty shell) · `/blog/feed/` (HTML) | 200 but 0 items / HTML | n/a | vendor | skip (→ crawl) | No usable feed; the blog is mostly evergreen 10DLC how-to guides anyway. Crawl `bandwidth.com/blog` if CPaaS-policy signal is wanted. |
| Telnyx | `https://telnyx.com/rss.xml` (release notes, 438 items) | 200, rss, 438 items | n/a | vendor | skip | The only Telnyx feed is a product-release changelog (Voice AI / STT / TTS) — off-topic. Compliance content lives in feedless `/resources` and `support.telnyx.com` articles → crawl candidate at best. |

---

## Crawl candidates (feedless but valuable — for the W2 / Firecrawl phase)

The best pure-news sources for **10DLC/TCR carrier-policy changes** have no feeds — this is the round's
biggest structural gap (see coverage map). Pursue these as Firecrawl change-tracking targets:

- **Telgorithm — News** (`https://www.telgorithm.com/news`) — reports actual carrier 10DLC actions
  (e.g. "Sinch announces enforcement of T-Mobile brand throughput limits", AT&T throughput changes).
  Webflow site, no RSS at any tested path.
- **SIPNEX — A2P 10DLC News tracker** (`https://www.sipnex.ca/blog/a2p-10dlc-news`) — a monthly-updated
  running tracker of rule changes, carrier fee updates, TCR requirement changes, and deadlines.
  No feed.
- **MyTCRPlus — Carrier Policy Updates**
  (`https://mytcrplus.com/resources/a2p-10dlc-tcpa-carrier-policy-updates/`) — structured T-Mobile/AT&T/
  Verizon/US Cellular policy + fine tracker. The feed is marketing-only; crawl the tracker pages.
- **CTIA — Messaging Principles & Best Practices** page
  (`https://www.ctia.org/the-wireless-industry/industry-commitments/messaging-interoperability-sms-mms`
  and the linked `api.ctia.org/.../Messaging-Principles-…PDF`) — crawl to detect a new Principles /
  SHAFT / short-code-handbook version (rare but high-impact; more reliable than the general CTIA feed).
- **Manatt — TCPA Connect** (`https://www.manatt.com/insights/newsletters/tcpa-connect`) — dedicated
  TCPA newsletter (covered the WA/OK/FL mini-TCPA laws). No feed.
- **Mintz — Viewpoints** (`https://www.mintz.com/insights-center/viewpoints`) — strong robocall/FCC
  enforcement analysis (RMD, KYC/KYUP). No feed.
- **Davis Wright Tremaine — Broadband Advisor** (`https://www.dwt.com/blogs/broadband-advisor`) —
  FCC robocall / STIR-SHAKEN rulemaking coverage. No feed.
- **Squire Patton Boggs — Consumer Financial Services Law Monitor**
  (`https://www.consumerfinancialserviceslawmonitor.com`) — WAF returns 403 to automated clients;
  covers TCPA/collections. Crawl or retry from Actions egress.
- **State-AG robocall / telephone-solicitation pages** (e.g. WA AG telephone-solicitation page per
  RCW 19.158; FL/OK/TX/VA mini-TCPA enforcement pages) — government pages, no feeds; low priority but
  the primary source for state mini-TCPA enforcement actions.

---

## Keyword coverage map

For each keyword, what covers it after this round (existing = already seeded; **new** = proposed
`seed-now` here; *crawl* = feedless candidate). This makes the gaps visible.

| Keyword | Covered by | Gap? |
|---|---|---|
| **TCPA** (litigation, consent, verdicts) | TCPAWorld *(existing)*, **Kelley Drye Ad Law Access**, **Duane Morris Class Action Defense**, **DNC.com**; *maybe:* Receivables Info, Klein Moynihan | Well covered. |
| **DNC / Do Not Call** | **DNC.com**, **Kelley Drye**, **Duane Morris**, TCPAWorld *(existing)* | Well covered. |
| **10DLC** (carrier policy, throughput, fees) | **TCR feed** (primary, low-freq), **The CommLaw Group** (FCC/carrier side only) | **GAP: no high-frequency 10DLC-news feed exists.** The live sources — Telgorithm, SIPNEX, MyTCRPlus trackers — are all feedless → this is the strongest argument for the crawl phase (or a future search-target). |
| **TCR (The Campaign Registry)** | **TCR feed** (primary, sporadic/stale) | Primary voice captured but low-frequency; TCR-change *news* really lives in the crawl candidates. |
| **CTIA guidelines / SHAFT / A2P consent** | **CTIA feed** (maybe, low density); *crawl:* CTIA Messaging Principles page | Thin — best served by crawling the Principles page for version bumps. |
| **STIR/SHAKEN · robocall mitigation DB · branded calling · KYC/KYUP** | **The CommLaw Group**; *maybe:* NumHub (stale); *crawl:* Mintz, DWT Broadband Advisor | Covered by CommLaw Group; Mintz/DWT would deepen it via crawl. |
| **State mini-TCPA (FTSA, OK, WA, VA, TX)** | **Kelley Drye**, **Duane Morris**, DNC.com, TCPAWorld *(existing)*; *crawl:* Manatt TCPA Connect, state-AG pages | Covered via commentary. |

### Bottom line on gaps

The single notable gap is a **high-frequency, feed-native 10DLC/TCR carrier-policy news source** —
the outlets that actually break carrier throughput/fee/registration changes (Telgorithm, SIPNEX,
MyTCRPlus) publish only to feedless web pages. Everything else in the keyword space is now reachable
via a verified feed. Recommend routing the 10DLC-carrier-policy gap to the W2/Firecrawl phase (or the
future search-targets decision) rather than forcing a low-value feed.
