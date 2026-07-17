import { Cadence, Relationship, SourceKind, Vertical } from "../config.js";

export type Competitor = {
  id: string;
  name: string;
  relationship: Relationship;
  aliases: string[];
  active: boolean;
};

export type Source = {
  id: string;
  kind: SourceKind;
  url: string;
  vertical: Vertical;
  competitor: string;
  cadence: Cadence;
  active: boolean;
  addedAt: number;
};
