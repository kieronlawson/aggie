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

const upsertRows = async (namespace: TpufNamespace, rows: TpufRow[]): Promise<void> => {
  await createTurbopuffer().namespace(namespace).write({
    upsert_rows: rows,
    distance_metric: "cosine_distance"
  });
};

export { ALL_NAMESPACES, createTurbopuffer, listNamespaces, TpufNamespace, type TpufRow, upsertRows };
