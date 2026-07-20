import { type CompetitorRecord, Relationship, SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";

/**
 * Registry seed: phase 0 set researched and URL-verified on 2026-07-17, plus the
 * sources-v2 additions Kieron approved on 2026-07-20 (see docs/sources-v2-candidates.md
 * for per-feed verification). Every feed/job-board URL returned HTTP 200 with the claimed
 * format at seed time, except where noted in SEED_NOTES. After phase 0 the registry is
 * edited only via W0 (or a reviewed seed.ts change re-run through seed).
 */

const ADDED_AT = "2026-07-17T00:00:00Z";
const ADDED_AT_V2 = "2026-07-20T00:00:00Z";

const SEED_COMPETITORS: CompetitorRecord[] = [
  { name: "RingCentral", relationship: Relationship.Displace, aliases: ["RNG", "RingCentral MVP", "RingEX"], active: true },
  { name: "8x8", relationship: Relationship.Displace, aliases: ["EGHT", "8X8"], active: true },
  { name: "Aircall", relationship: Relationship.Displace, aliases: [], active: true },
  { name: "UJET", relationship: Relationship.Displace, aliases: [], active: true },
  { name: "Twilio Flex", relationship: Relationship.Displace, aliases: ["Twilio"], active: true },
  { name: "Theta Lake", relationship: Relationship.Partner, aliases: ["ThetaLake"], active: true },
  { name: "Smarsh", relationship: Relationship.Partner, aliases: [], active: true }
];

const financeFeed = (name: string, url: string): SourceRecord => ({
  kind: SourceKind.Feed,
  url,
  name,
  vertical: Vertical.Finance,
  competitor: "",
  active: true,
  added_at: ADDED_AT
});

const competitorSource = (kind: SourceKind, name: string, url: string, competitor: string): SourceRecord => ({
  kind,
  url,
  name,
  vertical: Vertical.Competitor,
  competitor,
  active: true,
  added_at: ADDED_AT
});

const financeFeedV2 = (name: string, url: string): SourceRecord => ({
  ...financeFeed(name, url),
  added_at: ADDED_AT_V2
});

const REGULATOR_FEEDS: SourceRecord[] = [
  financeFeed("SEC press releases", "https://www.sec.gov/news/pressreleases.rss"),
  financeFeed("SEC litigation releases", "https://www.sec.gov/enforcement-litigation/litigation-releases/rss"),
  financeFeed("SEC administrative proceedings", "https://www.sec.gov/enforcement-litigation/administrative-proceedings/rss"),
  financeFeed("CFTC press releases", "https://www.cftc.gov/RSS/RSSGP/rssgp.xml"),
  financeFeed("FINRA news & speeches", "http://feeds.finra.org/FINRANews"),
  financeFeed("FINRA notices", "http://feeds.finra.org/FINRANotices"),
  financeFeedV2("CFPB newsroom", "https://www.consumerfinance.gov/about-us/newsroom/feed/"),
  financeFeedV2("Federal Reserve enforcement actions", "https://www.federalreserve.gov/feeds/press_enforcement.xml"),
  financeFeedV2("OCC news releases", "https://www.occ.gov/rss/occ_news.xml"),
  financeFeedV2("FTC press releases", "https://www.ftc.gov/feeds/press-release.xml"),
  financeFeedV2("The Campaign Registry (10DLC/TCR)", "https://www.campaignregistry.com/feed/")
];

const TRADE_PRESS_FEEDS: SourceRecord[] = [
  financeFeedV2("Compliance Week", "https://www.complianceweek.com/rss"),
  financeFeedV2("Banking Dive", "https://www.bankingdive.com/feeds/news/")
];

const COMMENTARY_FEEDS: SourceRecord[] = [
  financeFeed("JD Supra — Securities Law", "https://www.jdsupra.com/resources/syndication/docsRSSfeed.aspx?ftype=SecuritiesLaw&premium=1"),
  financeFeed("JD Supra — Finance & Banking", "https://www.jdsupra.com/resources/syndication/docsRSSfeed.aspx?ftype=FinanceBanking&premium=1"),
  financeFeed("Radical Compliance", "https://www.radicalcompliance.com/feed/"),
  financeFeed("Global Relay blog", "https://www.globalrelay.com/feed/"),
  financeFeed("National Law Review — recent contributions", "https://www.natlawreview.com/recent-contributions/feed"),
  financeFeedV2("TCPAWorld (Troutman Amin)", "https://www.tcpaworld.com/feed/"),
  financeFeedV2("Kelley Drye — Ad Law Access", "https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/rss"),
  financeFeedV2("Duane Morris — Class Action Defense", "https://blogs.duanemorris.com/classactiondefense/feed/"),
  financeFeedV2("The CommLaw Group", "https://commlawgroup.com/feed/"),
  financeFeedV2("DNC.com (Contact Center Compliance)", "https://www.dnc.com/blog/rss.xml")
];

const COMPETITOR_FEEDS: SourceRecord[] = [
  competitorSource(SourceKind.Feed, "SEC EDGAR filings — RingCentral (CIK 0001384905)",
    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001384905&type=&dateb=&owner=include&count=40&output=atom", "RingCentral"),
  competitorSource(SourceKind.Feed, "SEC EDGAR filings — 8x8 (CIK 0001023731)",
    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001023731&type=&dateb=&owner=include&count=40&output=atom", "8x8"),
  competitorSource(SourceKind.Feed, "Aircall status incidents", "https://status.aircall.io/history.rss", "Aircall"),
  competitorSource(SourceKind.Feed, "Twilio status incidents", "https://status.twilio.com/history.rss", "Twilio Flex"),
  competitorSource(SourceKind.Feed, "RingCentral blog", "https://www.ringcentral.com/us/en/blog/feed/", "RingCentral"),
  competitorSource(SourceKind.Feed, "Twilio blog", "https://www.twilio.com/en-us/blog.feed.xml", "Twilio Flex"),
  competitorSource(SourceKind.Feed, "UJET blog/news", "https://www.ujet.cx/rss.xml", "UJET"),
  competitorSource(SourceKind.Feed, "Theta Lake blog", "https://thetalake.com/feed/", "Theta Lake"),
  competitorSource(SourceKind.Feed, "Smarsh blog", "https://www.smarsh.com/feed/", "Smarsh")
];

const JOB_BOARDS: SourceRecord[] = [
  competitorSource(SourceKind.JobBoard, "UJET jobs (Greenhouse)", "https://boards-api.greenhouse.io/v1/boards/ujet/jobs", "UJET"),
  competitorSource(SourceKind.JobBoard, "Twilio jobs (Greenhouse)", "https://boards-api.greenhouse.io/v1/boards/twilio/jobs", "Twilio Flex"),
  competitorSource(SourceKind.JobBoard, "Aircall jobs (Lever)", "https://api.lever.co/v0/postings/aircall?mode=json", "Aircall"),
  competitorSource(SourceKind.JobBoard, "Smarsh jobs (Lever)", "https://api.lever.co/v0/postings/smarsh?mode=json", "Smarsh"),
  competitorSource(SourceKind.JobBoard, "Theta Lake jobs (SmartRecruiters)", "https://api.smartrecruiters.com/v1/companies/ThetaLake/postings", "Theta Lake"),
  {
    ...competitorSource(SourceKind.JobBoard, "RingCentral jobs (Workday — needs POST client, disabled)",
      "https://ringcentral.wd1.myworkdayjobs.com/wday/cxs/ringcentral/RingCentral_Careers/jobs", "RingCentral"),
    active: false
  },
  {
    ...competitorSource(SourceKind.JobBoard, "8x8 jobs (Workday — needs POST client, disabled)",
      "https://8x8inc.wd5.myworkdayjobs.com/wday/cxs/8x8inc/8x8_external_careers/jobs", "8x8"),
    active: false
  }
];

const CRAWL_TARGETS: SourceRecord[] = [
  competitorSource(SourceKind.Crawl, "RingCentral pricing", "https://www.ringcentral.com/office/plansandpricing.html", "RingCentral"),
  competitorSource(SourceKind.Crawl, "Aircall pricing", "https://aircall.io/pricing/", "Aircall"),
  competitorSource(SourceKind.Crawl, "UJET pricing", "https://www.ujet.cx/pricing", "UJET"),
  competitorSource(SourceKind.Crawl, "Twilio Flex pricing", "https://www.twilio.com/en-us/flex/pricing", "Twilio Flex"),
  competitorSource(SourceKind.Crawl, "8x8 pricing", "https://www.8x8.com/products/plans-and-pricing", "8x8"),
  competitorSource(SourceKind.Crawl, "RingCentral release notes", "https://support.ringcentral.com/release-notes.html", "RingCentral"),
  competitorSource(SourceKind.Crawl, "8x8 release notes", "https://support.8x8.com/release-notes", "8x8"),
  competitorSource(SourceKind.Crawl, "Twilio changelog", "https://www.twilio.com/en-us/changelog", "Twilio Flex"),
  competitorSource(SourceKind.Crawl, "RingCentral newsroom", "https://www.ringcentral.com/newsroom.html", "RingCentral"),
  competitorSource(SourceKind.Crawl, "RingCentral status page", "https://status.ringcentral.com/", "RingCentral"),
  competitorSource(SourceKind.Crawl, "8x8 status incidents", "https://8x8status.statuscast.com/incidents", "8x8"),
  competitorSource(SourceKind.Crawl, "Theta Lake integrations directory", "https://thetalake.com/integrations/", "Theta Lake"),
  competitorSource(SourceKind.Crawl, "Smarsh connectors directory", "https://www.smarsh.com/connectors", "Smarsh"),
  {
    ...financeFeed("FinCEN press releases", "https://www.fincen.gov/news/press-releases"),
    kind: SourceKind.Crawl
  }
];

const SEED_SOURCES: SourceRecord[] = [
  ...REGULATOR_FEEDS,
  ...TRADE_PRESS_FEEDS,
  ...COMMENTARY_FEEDS,
  ...COMPETITOR_FEEDS,
  ...JOB_BOARDS,
  ...CRAWL_TARGETS
];

const SEED_NOTES: string[] = [
  "All sec.gov URLs (press, litigation, EDGAR) require a declared-contact User-Agent " +
    "(e.g. \"Aggie Intel research@spokephone.com\") or they return 403; the phase 1 feed client must send it.",
  "FINRA feeds only work over http:// — the https:// host does not respond.",
  "FinCEN publishes no RSS; its press-release index is a crawl target instead.",
  "RingCentral and 8x8 status pages expose no RSS/Atom; both are weekly crawl targets, so outage " +
    "alerts for them are bounded by the crawl cadence, not the daily ingest.",
  "UJET's status portal is login-gated and not usable; no UJET or Aircall public changelog exists.",
  "RingCentral and 8x8 job boards run on Workday (POST API, not Greenhouse/Lever GET) — seeded " +
    "as inactive until a Workday client is approved in phase 2.",
  "Theta Lake's SmartRecruiters endpoint is valid but currently lists zero postings.",
  "8x8 pricing page returned 429 (Cloudflare rate limit) during verification — UNVERIFIED; " +
    "expected to work through Firecrawl in phase 3.",
  "Aircall publishes no blog RSS (their /feed URL serves an HTML app); coverage comes from " +
    "their status feed, Lever job board, and pricing-page crawl.",
  "Sources-v2 (2026-07-20): FTC press releases carry mostly non-telemarketing output — the " +
    "relevance gate does the filtering. Banking Dive is high-volume general banking news; same " +
    "reliance on the gate. TCPAWorld is law-firm commentary but functions as the fastest " +
    "robocall/TCPA/DNC news wire. FCC feeds reviewed and skipped (nothing materially useful); " +
    "ThinkAdvisor/InvestmentNews feeds are dead shells. See docs/sources-v2-candidates.md.",
  "Sources-v3 keyword round (2026-07-20, TCPA/10DLC/DNC/TCR): Kelley Drye, Duane Morris, CommLaw " +
    "Group, and DNC.com are commentary/vendor class — the evergreen split and relevance gate carry " +
    "the filtering. The Campaign Registry feed is authoritative but sporadic (~months between " +
    "posts); 10DLC carrier-policy trackers (Telgorithm, SIPNEX, MyTCRPlus, CTIA Principles page) " +
    "are feedless and queued as W2 crawl candidates. See docs/sources-v3-keyword-candidates.md."
];

export { SEED_COMPETITORS, SEED_NOTES, SEED_SOURCES };
