import * as R from "ramda";

import { queryRows, TpufNamespace, type TpufResultRow } from "#src/clients/turbopuffer.ts";
import { RecordType } from "#src/registry/records.ts";
import { type CompetitorRecord, Relationship, SourceKind, type SourceRecord, Vertical } from "#src/registry/types.ts";

const REGISTRY_QUERY_LIMIT = 500;

const str = (row: TpufResultRow, key: string): string => {
  const value = row[key];
  return typeof value === "string" ? value : "";
};

const rowToCompetitor = (row: TpufResultRow): CompetitorRecord => ({
  name: str(row, "name"),
  relationship:
    (str(row, "relationship") as Relationship) === Relationship.Partner ? Relationship.Partner : Relationship.Displace,
  aliases: Array.isArray(row["aliases"]) ? (row["aliases"] as string[]) : [],
  active: row["active"] === true
});

const rowToSource = (row: TpufResultRow): SourceRecord => {
  const kind = str(row, "kind");
  const vertical = str(row, "vertical");
  return {
    kind: kind.length > 0 ? (kind as SourceKind) : SourceKind.Feed,
    url: str(row, "url"),
    name: str(row, "name"),
    vertical: vertical.length > 0 ? (vertical as Vertical) : Vertical.Finance,
    competitor: str(row, "competitor"),
    active: row["active"] === true,
    added_at: str(row, "added_at")
  };
};

const loadCompetitors = async (): Promise<CompetitorRecord[]> => {
  const rows = await queryRows({
    namespace: TpufNamespace.Registry,
    filters: ["record_type", "Eq", RecordType.Competitor],
    topK: REGISTRY_QUERY_LIMIT
  });
  return R.map(rowToCompetitor, rows);
};

const loadActiveSources = async (kind: SourceKind): Promise<SourceRecord[]> => {
  const rows = await queryRows({
    namespace: TpufNamespace.Registry,
    filters: [
      "And",
      [
        ["record_type", "Eq", RecordType.Source],
        ["kind", "Eq", kind],
        ["active", "Eq", true]
      ]
    ],
    topK: REGISTRY_QUERY_LIMIT
  });
  return R.map(rowToSource, rows);
};

export { loadActiveSources, loadCompetitors };
