import { Cadence, Relationship, SourceKind, Vertical } from "../config.js";
import { newCompetitor, newSource } from "./store.js";
import type { Competitor, Source } from "./types.js";

// v1 seed list, researched and probed on 2026-07-17. Every feed/job_board URL
// below returned a valid feed or JSON at seed time; crawl URLs are validated
// by W2 in phase 3. See docs/sources-v1.md for the reviewable export.

const RINGCENTRAL = "RingCentral";
const EIGHT_X_EIGHT = "8x8";
const AIRCALL = "Aircall";
const UJET = "UJET";
const TWILIO_FLEX = "Twilio Flex";
const THETA_LAKE = "Theta Lake";
const SMARSH = "Smarsh";

export const seedCompetitors = (): Competitor[] => [
  newCompetitor(RINGCENTRAL, Relationship.Displace, ["RNG", "RingEX", "RingCX"]),
  newCompetitor(EIGHT_X_EIGHT, Relationship.Displace, ["EGHT", "8x8 Inc"]),
  newCompetitor(AIRCALL, Relationship.Displace, []),
  newCompetitor(UJET, Relationship.Displace, ["UJET Inc"]),
  newCompetitor(TWILIO_FLEX, Relationship.Displace, ["Twilio"]),
  newCompetitor(THETA_LAKE, Relationship.Partner, []),
  newCompetitor(SMARSH, Relationship.Partner, ["TeleMessage"])
];

type SeedSpec = { kind: SourceKind; url: string; vertical: Vertical; competitor?: string; cadence?: Cadence };

const googleNews = (query: string): string =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

const SEED_SPECS: readonly SeedSpec[] = [
  // Finance regulators (track 1)
  { kind: SourceKind.Feed, url: "https://www.sec.gov/news/pressreleases.rss", vertical: Vertical.Finance },
  { kind: SourceKind.Feed, url: "https://www.finra.org/rss.xml", vertical: Vertical.Finance },
  { kind: SourceKind.Feed, url: "https://www.cftc.gov/RSS/RSSGP/rssgp.xml", vertical: Vertical.Finance },
  { kind: SourceKind.Feed, url: "https://www.consumerfinance.gov/about-us/newsroom/feed/", vertical: Vertical.Finance },
  { kind: SourceKind.Feed, url: "https://www.ftc.gov/feeds/press-release.xml", vertical: Vertical.Finance },
  // EDGAR per-company filings
  {
    kind: SourceKind.Feed,
    url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001384905&type=&dateb=&owner=include&count=40&output=atom",
    vertical: Vertical.Competitor,
    competitor: RINGCENTRAL
  },
  {
    kind: SourceKind.Feed,
    url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001023731&type=&dateb=&owner=include&count=40&output=atom",
    vertical: Vertical.Competitor,
    competitor: EIGHT_X_EIGHT
  },
  // Status-page incident feeds (RingCentral/8x8 status pages have no feeds -> crawl below)
  { kind: SourceKind.Feed, url: "https://status.twilio.com/history.rss", vertical: Vertical.Competitor, competitor: TWILIO_FLEX },
  { kind: SourceKind.Feed, url: "https://status.aircall.io/history.rss", vertical: Vertical.Competitor, competitor: AIRCALL },
  { kind: SourceKind.Feed, url: "https://status.ujet.co/history.rss", vertical: Vertical.Competitor, competitor: UJET },
  // Competitor blogs / newsrooms with working feeds
  { kind: SourceKind.Feed, url: "https://www.ringcentral.com/blog/feed/", vertical: Vertical.Competitor, competitor: RINGCENTRAL },
  { kind: SourceKind.Feed, url: "https://www.twilio.com/blog/feed", vertical: Vertical.Competitor, competitor: TWILIO_FLEX },
  { kind: SourceKind.Feed, url: "https://thetalake.com/feed/", vertical: Vertical.Competitor, competitor: THETA_LAKE },
  { kind: SourceKind.Feed, url: "https://www.smarsh.com/blog/feed", vertical: Vertical.Competitor, competitor: SMARSH },
  // Google News per competitor (press coverage incl. syndicated reprints)
  { kind: SourceKind.Feed, url: googleNews('"RingCentral"'), vertical: Vertical.Competitor, competitor: RINGCENTRAL },
  { kind: SourceKind.Feed, url: googleNews('"8x8" cloud'), vertical: Vertical.Competitor, competitor: EIGHT_X_EIGHT },
  { kind: SourceKind.Feed, url: googleNews('"Aircall"'), vertical: Vertical.Competitor, competitor: AIRCALL },
  { kind: SourceKind.Feed, url: googleNews('"UJET"'), vertical: Vertical.Competitor, competitor: UJET },
  { kind: SourceKind.Feed, url: googleNews('"Twilio Flex"'), vertical: Vertical.Competitor, competitor: TWILIO_FLEX },
  { kind: SourceKind.Feed, url: googleNews('"Theta Lake"'), vertical: Vertical.Competitor, competitor: THETA_LAKE },
  { kind: SourceKind.Feed, url: googleNews('"Smarsh"'), vertical: Vertical.Competitor, competitor: SMARSH },
  // Job boards (weekly; RingCentral & 8x8 use Workday - no public JSON, noted in sources doc)
  { kind: SourceKind.JobBoard, url: "https://api.lever.co/v0/postings/aircall?mode=json", vertical: Vertical.Competitor, competitor: AIRCALL, cadence: Cadence.Weekly },
  { kind: SourceKind.JobBoard, url: "https://boards-api.greenhouse.io/v1/boards/ujet/jobs?content=true", vertical: Vertical.Competitor, competitor: UJET, cadence: Cadence.Weekly },
  { kind: SourceKind.JobBoard, url: "https://boards-api.greenhouse.io/v1/boards/twilio/jobs?content=true", vertical: Vertical.Competitor, competitor: TWILIO_FLEX, cadence: Cadence.Weekly },
  { kind: SourceKind.JobBoard, url: "https://api.lever.co/v0/postings/smarsh?mode=json", vertical: Vertical.Competitor, competitor: SMARSH, cadence: Cadence.Weekly },
  // Firecrawl change-tracking pages (W2, weekly)
  { kind: SourceKind.Crawl, url: "https://status.ringcentral.com/", vertical: Vertical.Competitor, competitor: RINGCENTRAL, cadence: Cadence.Weekly },
  { kind: SourceKind.Crawl, url: "https://status.8x8.com/", vertical: Vertical.Competitor, competitor: EIGHT_X_EIGHT, cadence: Cadence.Weekly },
  { kind: SourceKind.Crawl, url: "https://www.ringcentral.com/office/plansandpricing.html", vertical: Vertical.Competitor, competitor: RINGCENTRAL, cadence: Cadence.Weekly },
  { kind: SourceKind.Crawl, url: "https://www.8x8.com/products/plans-and-pricing", vertical: Vertical.Competitor, competitor: EIGHT_X_EIGHT, cadence: Cadence.Weekly },
  { kind: SourceKind.Crawl, url: "https://aircall.io/pricing/", vertical: Vertical.Competitor, competitor: AIRCALL, cadence: Cadence.Weekly },
  { kind: SourceKind.Crawl, url: "https://www.twilio.com/en-us/flex/pricing", vertical: Vertical.Competitor, competitor: TWILIO_FLEX, cadence: Cadence.Weekly },
  { kind: SourceKind.Crawl, url: "https://ujet.cx/pricing", vertical: Vertical.Competitor, competitor: UJET, cadence: Cadence.Weekly },
  { kind: SourceKind.Crawl, url: "https://www.8x8.com/blog", vertical: Vertical.Competitor, competitor: EIGHT_X_EIGHT, cadence: Cadence.Weekly },
  { kind: SourceKind.Crawl, url: "https://aircall.io/blog/", vertical: Vertical.Competitor, competitor: AIRCALL, cadence: Cadence.Weekly },
  { kind: SourceKind.Crawl, url: "https://thetalake.com/integrations/", vertical: Vertical.Competitor, competitor: THETA_LAKE, cadence: Cadence.Weekly },
  { kind: SourceKind.Crawl, url: "https://www.smarsh.com/platform/channels", vertical: Vertical.Competitor, competitor: SMARSH, cadence: Cadence.Weekly }
];

export const seedSources = (): Source[] =>
  SEED_SPECS.map((spec) =>
    newSource({
      kind: spec.kind,
      url: spec.url,
      vertical: spec.vertical,
      competitor: spec.competitor ?? "",
      cadence: spec.cadence ?? Cadence.Daily
    })
  );
