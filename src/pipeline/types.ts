import { type Relationship, type Vertical } from "#src/registry/types.ts";

enum Classification {
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

enum Sentiment {
  Mild = "mild",
  Moderate = "moderate",
  Severe = "severe"
}

enum DedupeVerdict {
  Duplicate = "duplicate",
  SameStory = "same_story",
  Distinct = "distinct"
}

enum ContentKind {
  News = "news",
  Evergreen = "evergreen"
}

/** An item as fetched from a source, before classification. */
type RawItem = {
  url: string;
  title: string;
  content: string;
  published_at: string;
  source: string;
  vertical: Vertical;
  competitor: string;
  relationship: Relationship;
};

type ClassifyResult = {
  classification: Classification;
  sentiment: Sentiment | "";
  title: string;
  summary: string;
  entities: string[];
  /** False when the item does not touch communications compliance or a tracked competitor. */
  relevant: boolean;
  /** Evergreen = undated guidance/thought-leadership; excluded from digest stories. */
  content_kind: ContentKind;
};

/** Fully processed item, matching the TurboPuffer item-namespace attributes. */
type ProcessedItem = RawItem & ClassifyResult & {
  content_hash: string;
  merged_urls: string[];
  story_id: string;
  published_at_ms: number;
};

export { Classification, type ClassifyResult, ContentKind, DedupeVerdict, type ProcessedItem, type RawItem, Sentiment };
