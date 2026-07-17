import { createHash } from "node:crypto";
import { Cadence, EMBED_DIMS, NAMESPACE_REGISTRY, Relationship, SourceKind, Vertical } from "../config.js";
import { scanRows, upsertRows, type TpufRow } from "../clients/turbopuffer.js";
import { nowSeconds } from "../lib/time.js";
import type { Competitor, Source } from "./types.js";

const RECORD_COMPETITOR = "competitor";
const RECORD_SOURCE = "source";
const SOURCE_ID_LENGTH = 12;

export const dummyVector = (): number[] => [1, ...Array.from({ length: EMBED_DIMS - 1 }, () => 0)];

export const slugify = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const sourceId = (url: string): string =>
  `src-${createHash("sha256").update(url).digest("hex").slice(0, SOURCE_ID_LENGTH)}`;

const competitorToRow = (competitor: Competitor): TpufRow => ({
  id: competitor.id,
  vector: dummyVector(),
  record_type: RECORD_COMPETITOR,
  name: competitor.name,
  relationship: competitor.relationship,
  aliases: competitor.aliases,
  active: competitor.active
});

const sourceToRow = (source: Source): TpufRow => ({
  id: source.id,
  vector: dummyVector(),
  record_type: RECORD_SOURCE,
  kind: source.kind,
  url: source.url,
  vertical: source.vertical,
  competitor: source.competitor,
  cadence: source.cadence,
  active: source.active,
  added_at: source.addedAt
});

const rowToCompetitor = (row: TpufRow): Competitor => ({
  id: row.id,
  name: String(row.name ?? ""),
  relationship: String(row.relationship ?? "") as Relationship,
  aliases: (row.aliases as string[] | undefined) ?? [],
  active: row.active === true
});

const rowToSource = (row: TpufRow): Source => ({
  id: row.id,
  kind: String(row.kind ?? "") as SourceKind,
  url: String(row.url ?? ""),
  vertical: String(row.vertical ?? "") as Vertical,
  competitor: String(row.competitor ?? ""),
  cadence: String(row.cadence ?? Cadence.Daily) as Cadence,
  active: row.active === true,
  addedAt: Number(row.added_at ?? 0)
});

export const listCompetitors = async (): Promise<Competitor[]> => {
  const rows = await scanRows(NAMESPACE_REGISTRY, ["record_type", "Eq", RECORD_COMPETITOR]);
  return rows.map(rowToCompetitor);
};

export const listSources = async (): Promise<Source[]> => {
  const rows = await scanRows(NAMESPACE_REGISTRY, ["record_type", "Eq", RECORD_SOURCE]);
  return rows.map(rowToSource);
};

export const activeSourcesByKind = async (kinds: readonly SourceKind[]): Promise<Source[]> => {
  const sources = await listSources();
  return sources.filter((source) => source.active && kinds.includes(source.kind));
};

export const upsertCompetitors = async (competitors: readonly Competitor[]): Promise<void> =>
  upsertRows(NAMESPACE_REGISTRY, competitors.map(competitorToRow));

export const upsertSources = async (sources: readonly Source[]): Promise<void> =>
  upsertRows(NAMESPACE_REGISTRY, sources.map(sourceToRow));

export const newCompetitor = (
  name: string,
  relationship: Relationship,
  aliases: readonly string[]
): Competitor => ({
  id: `comp-${slugify(name)}`,
  name,
  relationship,
  aliases: [...aliases],
  active: true
});

export type NewSourceInput = {
  kind: SourceKind;
  url: string;
  vertical: Vertical;
  competitor: string;
  cadence: Cadence;
};

export const newSource = (input: NewSourceInput): Source => ({
  id: sourceId(input.url),
  kind: input.kind,
  url: input.url,
  vertical: input.vertical,
  competitor: input.competitor,
  cadence: input.cadence,
  active: true,
  addedAt: nowSeconds()
});

export const competitorNameExists = (competitors: readonly Competitor[], name: string): boolean => {
  const needle = name.trim().toLowerCase();
  return competitors.some(
    (competitor) =>
      competitor.name.toLowerCase() === needle ||
      competitor.aliases.some((alias) => alias.toLowerCase() === needle)
  );
};
