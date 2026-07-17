import { Classification, Relationship, Sentiment, SourceKind, Vertical } from "../config.js";

export type RawItem = {
  url: string;
  sourceId: string;
  sourceKind: SourceKind;
  vertical: Vertical;
  competitor: string;
  relationship: Relationship;
  title: string;
  content: string;
  publishedAt: number;
  diff: string;
};

export type ClassifiedFields = {
  classification: Classification;
  sentiment: Sentiment | null;
  title: string;
  summary: string;
  entities: string[];
};

export type StoredItem = {
  id: string;
  url: string;
  source: string;
  vertical: Vertical;
  competitor: string;
  relationship: Relationship;
  classification: Classification;
  sentiment: string;
  published_at: number;
  title: string;
  summary: string;
  merged_urls: string[];
  content_hash: string;
  story_id: string;
};
