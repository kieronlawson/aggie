import { requireEnv, turbopufferRegion } from "../config.js";
import { fetchJson } from "../lib/http.js";

export type TpufRow = { id: string; vector?: number[] } & Record<string, unknown>;

export type TpufFilter = unknown[];

export type TpufQuery = {
  rank_by: unknown[];
  top_k: number;
  filters?: TpufFilter;
  include_attributes?: boolean | string[];
};

const DISTANCE_METRIC = "cosine_distance";

const baseUrl = (): string => `https://${turbopufferRegion()}.turbopuffer.com`;

const authHeaders = (): Record<string, string> => ({
  authorization: `Bearer ${requireEnv("TURBOPUFFER_API_KEY")}`
});

export const upsertRows = async (namespace: string, rows: readonly TpufRow[]): Promise<void> => {
  if (rows.length === 0) {
    return;
  }
  await fetchJson(`${baseUrl()}/v2/namespaces/${namespace}`, {
    method: "POST",
    headers: authHeaders(),
    body: { upsert_rows: rows, distance_metric: DISTANCE_METRIC }
  });
};

export const queryRows = async (namespace: string, query: TpufQuery): Promise<TpufRow[]> => {
  const result = (await fetchJson(`${baseUrl()}/v2/namespaces/${namespace}/query`, {
    method: "POST",
    headers: authHeaders(),
    body: query
  })) as { rows?: TpufRow[] };
  return result.rows ?? [];
};

export const listNamespaces = async (): Promise<string[]> => {
  const result = (await fetchJson(`${baseUrl()}/v2/namespaces`, {
    headers: authHeaders()
  })) as { namespaces?: { id: string }[] };
  return (result.namespaces ?? []).map((namespace) => namespace.id);
};

const SCAN_LIMIT = 1200;

export const scanRows = async (namespace: string, filters?: TpufFilter): Promise<TpufRow[]> =>
  queryRows(namespace, {
    rank_by: ["id", "asc"],
    top_k: SCAN_LIMIT,
    ...(filters === undefined ? {} : { filters }),
    include_attributes: true
  });
