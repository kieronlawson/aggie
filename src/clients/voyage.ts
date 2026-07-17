import { EMBED_MODEL, requireEnv } from "../config.js";
import { fetchJson } from "../lib/http.js";

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MAX_BATCH = 128;

type VoyageResponse = { data?: { embedding: number[] }[] };

const embedBatch = async (texts: readonly string[]): Promise<number[][]> => {
  const result = (await fetchJson(VOYAGE_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${requireEnv("VOYAGE_API_KEY")}` },
    body: { model: EMBED_MODEL, input: texts }
  })) as VoyageResponse;
  const data = result.data ?? [];
  if (data.length !== texts.length) {
    throw new Error(`Voyage returned ${data.length} embeddings for ${texts.length} inputs`);
  }
  return data.map((entry) => entry.embedding);
};

const chunk = <A>(items: readonly A[], size: number): A[][] =>
  items.length <= size
    ? [([...items])]
    : [items.slice(0, size), ...chunk(items.slice(size), size)];

export const embedTexts = async (texts: readonly string[]): Promise<number[][]> => {
  if (texts.length === 0) {
    return [];
  }
  const batches = chunk(texts, MAX_BATCH);
  const results = await batches.reduce<Promise<number[][]>>(async (accPromise, batch) => {
    const acc = await accPromise;
    const embeddings = await embedBatch(batch);
    return [...acc, ...embeddings];
  }, Promise.resolve([]));
  return results;
};

export const embedText = async (text: string): Promise<number[]> => {
  const [embedding] = await embedTexts([text]);
  if (embedding === undefined) {
    throw new Error("Voyage returned no embedding");
  }
  return embedding;
};
