import { createHash } from "node:crypto";

import * as R from "ramda";

import { type TpufRow } from "#src/clients/turbopuffer.ts";
import { type CompetitorRecord, type SourceRecord } from "#src/registry/types.ts";

/** Must match the embedding dimension used across all namespaces (voyage-4 default). */
const REGISTRY_VECTOR_DIMS = 1024;

enum RecordType {
  Competitor = "competitor",
  Source = "source"
}

const URL_ID_HASH_LENGTH = 16;

const dummyVector = (): number[] => [1, ...new Array<number>(REGISTRY_VECTOR_DIMS - 1).fill(0)];

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");

const sourceId = (url: string): string => {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, URL_ID_HASH_LENGTH);
  return `source:${hash}`;
};

const competitorId = (name: string): string => `competitor:${slugify(name)}`;

const competitorToRow = (record: CompetitorRecord): TpufRow => ({
  id: competitorId(record.name),
  vector: dummyVector(),
  record_type: RecordType.Competitor,
  name: record.name,
  relationship: record.relationship,
  aliases: record.aliases,
  active: record.active
});

const sourceToRow = (record: SourceRecord): TpufRow => ({
  id: sourceId(record.url),
  vector: dummyVector(),
  record_type: RecordType.Source,
  kind: record.kind,
  url: record.url,
  name: record.name,
  vertical: record.vertical,
  competitor: record.competitor,
  active: record.active,
  added_at: record.added_at
});

const isValidUrl = (value: string): boolean => URL.canParse(value);

const validateRegistry = (competitors: CompetitorRecord[], sources: SourceRecord[]): string[] => {
  const competitorNames = new Set(R.map((competitor) => competitor.name, competitors));
  const duplicateCompetitors = R.pipe(
    R.countBy((competitor: CompetitorRecord) => competitor.name),
    R.toPairs,
    R.filter(([, count]: [string, number]) => count > 1),
    R.map(([name]: [string, number]) => `Duplicate competitor name: ${name}`)
  )(competitors);
  const duplicateUrls = R.pipe(
    R.countBy((source: SourceRecord) => source.url),
    R.toPairs,
    R.filter(([, count]: [string, number]) => count > 1),
    R.map(([url]: [string, number]) => `Duplicate source URL: ${url}`)
  )(sources);
  const unknownCompetitors = R.pipe(
    R.filter((source: SourceRecord) => source.competitor.length > 0 && !competitorNames.has(source.competitor)),
    R.map((source: SourceRecord) => `Source ${source.url} references unknown competitor: ${source.competitor}`)
  )(sources);
  const badUrls = R.pipe(
    R.reject((source: SourceRecord) => isValidUrl(source.url)),
    R.map((source: SourceRecord) => `Source has invalid URL: ${source.url}`)
  )(sources);
  return [...duplicateCompetitors, ...duplicateUrls, ...unknownCompetitors, ...badUrls];
};

export { competitorId, competitorToRow, dummyVector, RecordType, sourceId, sourceToRow, validateRegistry };
