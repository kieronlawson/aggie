# Aggie source registry — v1 (finance launch)

**Date:** 2026-07-17
**Status:** For Kieron's phase-0 review.

This is the seed list compiled in `src/registry/seed.ts` and loaded into the TurboPuffer
`registry` namespace by W0 (`action: seed`). After the review, W0 (`action: export`) regenerates
this file from the live registry at each phase gate. Every feed and job-board URL below returned a
valid feed or JSON payload when probed on 2026-07-17; crawl URLs are validated by W2 in phase 3.

## Competitors

| Name | Relationship | Aliases | Notes |
|---|---|---|---|
| RingCentral | displace | RNG, RingEX, RingCX | Primary displacement target |
| 8x8 | displace | EGHT, 8x8 Inc | Primary displacement target |
| Aircall | displace | — | Flex/UJET/Aircall category |
| UJET | displace | UJET Inc | Flex/UJET/Aircall category |
| Twilio Flex | displace | Twilio | Flex/UJET/Aircall category |
| Theta Lake | partner | — | Compliance partner set |
| Smarsh | partner | TeleMessage | Compliance partner set |

## Feeds (daily, no crawling)

**Regulatory (finance vertical, track 1)**

| URL | Notes |
|---|---|
| https://www.sec.gov/news/pressreleases.rss | SEC press releases |
| https://www.finra.org/rss.xml | FINRA newsroom |
| https://www.cftc.gov/RSS/RSSGP/rssgp.xml | CFTC press releases |
| https://www.consumerfinance.gov/about-us/newsroom/feed/ | CFPB newsroom |
| https://www.ftc.gov/feeds/press-release.xml | FTC press releases |

**EDGAR per-company filings (track 2, displace)**

| URL | Company |
|---|---|
| SEC EDGAR atom, CIK 0001384905 | RingCentral (10-Q/10-K/8-K) |
| SEC EDGAR atom, CIK 0001023731 | 8x8 |

**Competitor status-page incident feeds**

| URL | Company |
|---|---|
| https://status.twilio.com/history.rss | Twilio Flex |
| https://status.aircall.io/history.rss | Aircall |
| https://status.ujet.co/history.rss | UJET |

**Competitor blogs / newsrooms**

| URL | Company |
|---|---|
| https://www.ringcentral.com/blog/feed/ | RingCentral |
| https://www.twilio.com/blog/feed | Twilio Flex |
| https://thetalake.com/feed/ | Theta Lake |
| https://www.smarsh.com/blog/feed | Smarsh |

**Google News per competitor** (catches press coverage and syndicated reprints; exercises the
dedupe layers on real syndication)

RingCentral, 8x8, Aircall, UJET, Twilio Flex, Theta Lake, Smarsh — one `news.google.com/rss/search`
query each.

## Job boards (weekly, JSON — no scraping)

| URL | Company | Provider |
|---|---|---|
| api.lever.co/v0/postings/aircall | Aircall | Lever |
| boards-api.greenhouse.io/v1/boards/ujet/jobs | UJET | Greenhouse |
| boards-api.greenhouse.io/v1/boards/twilio/jobs | Twilio Flex | Greenhouse |
| api.lever.co/v0/postings/smarsh | Smarsh | Lever |

## Firecrawl change-tracking (weekly, phase 3)

Pricing pages, status pages (RingCentral/8x8 have no incident feed — crawled instead), blogs
without feeds, and partner integration directories:

- RingCentral / 8x8 status pages
- RingCentral, 8x8, Aircall, Twilio Flex, UJET pricing pages
- 8x8 and Aircall blogs (no working feed)
- Theta Lake integrations directory, Smarsh channels/coverage page

## Known gaps (for review)

- **RingCentral & 8x8 job boards**: both use Workday, which has no stable public JSON endpoint.
  Left out of v1; revisit as a crawl source if hiring signal for them proves valuable.
- **Aircall / UJET blogs**: JS-rendered, no RSS — moved to the Firecrawl set rather than feeds.
- **HHS/OCR & state regulators**: HHS press feed blocks datacenter egress (403). Deferred to the
  insurance/healthcare seed (phase 4), where these matter more; finance launch relies on
  SEC/FINRA/CFTC/CFPB/FTC.
- **FINRA disciplinary actions**: only the general newsroom feed is public; enforcement detail
  comes through as press releases and Google News.
