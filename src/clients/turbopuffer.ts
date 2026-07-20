import Turbopuffer from "@turbopuffer/turbopuffer";

import { requireEnv } from "#src/config.ts";

enum TpufNamespace {
  Registry = "registry",
  ItemsFinance = "items-finance",
  ItemsInsurance = "items-insurance",
  ItemsHealthcare = "items-healthcare",
  ItemsCompetitor = "items-competitor",
  Reports = "reports"
}

const ALL_NAMESPACES: TpufNamespace[] = Object.values(TpufNamespace);

const DEFAULT_REGION = "gcp-us-central1";

const createTurbopuffer = (): Turbopuffer =>
  new Turbopuffer({
    apiKey: requireEnv("TURBOPUFFER_API_KEY"),
    region: process.env["TURBOPUFFER_REGION"] ?? DEFAULT_REGION
  });

const listNamespaces = async (): Promise<string[]> => {
  const page = await createTurbopuffer().namespaces({});
  return page.namespaces.map((ns) => ns.id);
};

type TpufRow = Record<string, unknown> & { id: string | number };

type TpufResultRow = Record<string, unknown> & { id: string | number; $dist?: number; vector?: number[] };

type TpufFilter = unknown[];

type TpufSchema = Record<string, { type: string; filterable?: boolean }>;

const upsertRows = async (namespace: TpufNamespace, rows: TpufRow[], schema?: TpufSchema): Promise<void> => {
  await createTurbopuffer().namespace(namespace).write({
    upsert_rows: rows,
    distance_metric: "cosine_distance",
    ...(schema === undefined ? {} : { schema })
  });
};

const patchRows = async (namespace: TpufNamespace, rows: TpufRow[]): Promise<void> => {
  await createTurbopuffer().namespace(namespace).write({ patch_rows: rows });
};

type QueryRowsOpts = {
  namespace: TpufNamespace;
  filters?: TpufFilter;
  topK: number;
  includeAttributes?: true | string[];
  orderBy?: [string, "asc" | "desc"];
};

const MISSING_ATTRIBUTE_PATTERN = /attribute\b.*\bnot found/u;

/**
 * A namespace that has never stored a row with the filtered/ranked/included
 * attribute rejects the query outright; for our queries that simply means
 * "no matches yet" (fresh namespace containing only the bootstrap marker).
 * Covers both error shapes: `filter error in key ...: attribute not found`
 * and `attribute "x" not found in schema`.
 */
const emptyIfMissingAttribute = (error: unknown): TpufResultRow[] => {
  const message = error instanceof Error ? error.message : String(error);
  if (MISSING_ATTRIBUTE_PATTERN.test(message)) {
    return [];
  }
  throw error;
};

/** Filter-only listing query, ordered by an attribute (default: id asc). */
const queryRows = async (opts: QueryRowsOpts): Promise<TpufResultRow[]> => {
  try {
    const result = await createTurbopuffer().namespace(opts.namespace).query({
      rank_by: [opts.orderBy?.[0] ?? "id", opts.orderBy?.[1] ?? "asc"],
      top_k: opts.topK,
      include_attributes: opts.includeAttributes ?? true,
      ...(opts.filters === undefined ? {} : { filters: opts.filters })
    } as Parameters<ReturnType<Turbopuffer["namespace"]>["query"]>[0]);
    return (result.rows ?? []) as TpufResultRow[];
  } catch (error) {
    return emptyIfMissingAttribute(error);
  }
};

type QueryNearestOpts = {
  namespace: TpufNamespace;
  vector: number[];
  topK: number;
  filters?: TpufFilter;
};

/** ANN query; rows carry $dist (cosine distance = 1 - cosine similarity). */
const queryNearest = async (opts: QueryNearestOpts): Promise<TpufResultRow[]> => {
  const result = await createTurbopuffer().namespace(opts.namespace).query({
    rank_by: ["vector", "ANN", opts.vector],
    top_k: opts.topK,
    include_attributes: true,
    ...(opts.filters === undefined ? {} : { filters: opts.filters })
  } as Parameters<ReturnType<Turbopuffer["namespace"]>["query"]>[0]);
  return (result.rows ?? []) as TpufResultRow[];
};

export {
  ALL_NAMESPACES,
  createTurbopuffer,
  listNamespaces,
  patchRows,
  queryNearest,
  queryRows,
  TpufNamespace,
  type TpufResultRow,
  type TpufRow,
  type TpufSchema,
  upsertRows
};
