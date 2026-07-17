export enum Vertical {
  Finance = "finance",
  Insurance = "insurance",
  Healthcare = "healthcare",
  Competitor = "competitor"
}

export enum Relationship {
  Regulatory = "regulatory",
  Displace = "displace",
  Partner = "partner"
}

export enum SourceKind {
  Feed = "feed",
  JobBoard = "job_board",
  Crawl = "crawl"
}

export enum Cadence {
  Daily = "daily",
  Weekly = "weekly"
}

export enum Classification {
  EnforcementAction = "enforcement_action",
  RuleChange = "rule_change",
  Guidance = "guidance",
  Commentary = "commentary",
  ProductAnnouncement = "product_announcement",
  PricingChange = "pricing_change",
  CustomerWin = "customer_win",
  Complaint = "complaint",
  Outage = "outage",
  Partnership = "partnership",
  MaActivity = "ma_activity",
  HiringSignal = "hiring_signal",
  Other = "other"
}

export enum Sentiment {
  Mild = "mild",
  Moderate = "moderate",
  Severe = "severe"
}

export enum OutputStage {
  Staging = "staging",
  Production = "production"
}

export const NAMESPACE_REGISTRY = "registry";
export const NAMESPACE_REPORTS = "reports";
export const ITEM_NAMESPACES: readonly string[] = [
  "items-finance",
  "items-insurance",
  "items-healthcare",
  "items-competitor"
];
export const ALL_NAMESPACES: readonly string[] = [
  NAMESPACE_REGISTRY,
  ...ITEM_NAMESPACES,
  NAMESPACE_REPORTS
];

export const itemsNamespace = (vertical: Vertical): string => `items-${vertical}`;

export const CLASSIFY_MODEL = "claude-haiku-4-5";
export const SYNTH_MODEL = "claude-opus-4-8";
export const EMBED_MODEL = "voyage-3.5";
export const EMBED_DIMS = 1024;

const DEFAULT_DEDUPE_THRESHOLD = 0.9;
const DEFAULT_REGION = "gcp-us-east4";

export const env = (name: string, fallback: string): string => {
  const value = process.env[name];
  return value !== undefined && value !== "" ? value : fallback;
};

export const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
};

export const turbopufferRegion = (): string => env("TURBOPUFFER_REGION", DEFAULT_REGION);

export const dedupeCandidateThreshold = (): number =>
  Number(env("DEDUPE_CANDIDATE_THRESHOLD", String(DEFAULT_DEDUPE_THRESHOLD)));

export const alertSentimentThreshold = (): Sentiment =>
  env("ALERT_SENTIMENT_THRESHOLD", Sentiment.Moderate) as Sentiment;

const CHANNEL_STAGING = "#intel-staging";
const CHANNEL_DIGEST = "#intel-digest";
const CHANNEL_ALERTS = "#competitive-intel";

const isProduction = (): boolean => env("OUTPUT_STAGE", OutputStage.Staging) === OutputStage.Production;

export const stagingChannel = (): string => env("SLACK_CHANNEL_STAGING", CHANNEL_STAGING);

export const digestChannel = (): string =>
  isProduction() ? env("SLACK_CHANNEL_DIGEST", CHANNEL_DIGEST) : stagingChannel();

export const alertChannel = (): string =>
  isProduction() ? env("SLACK_CHANNEL_ALERTS", CHANNEL_ALERTS) : stagingChannel();
