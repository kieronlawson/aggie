enum Vertical {
  Finance = "finance",
  Insurance = "insurance",
  Healthcare = "healthcare",
  Competitor = "competitor"
}

enum Relationship {
  Regulatory = "regulatory",
  Displace = "displace",
  Partner = "partner"
}

enum SourceKind {
  Feed = "feed",
  JobBoard = "job_board",
  Crawl = "crawl"
}

type CompetitorRecord = {
  name: string;
  relationship: Relationship.Displace | Relationship.Partner;
  aliases: string[];
  active: boolean;
};

type SourceRecord = {
  kind: SourceKind;
  url: string;
  name: string;
  vertical: Vertical;
  competitor: string;
  active: boolean;
  added_at: string;
};

export { type CompetitorRecord, Relationship, SourceKind, type SourceRecord, Vertical };
