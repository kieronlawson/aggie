import { requireEnv } from "#src/config.ts";

const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_MODEL = "voyage-4";

type VoyageInputType = "document" | "query";

type VoyageEmbeddingsResponse = {
  data: { embedding: number[] }[];
  model: string;
};

const embed = async (texts: string[], inputType: VoyageInputType): Promise<number[][]> => {
  const response = await fetch(VOYAGE_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("VOYAGE_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ input: texts, model: EMBEDDING_MODEL, input_type: inputType })
  });
  if (!response.ok) {
    throw new Error(`Voyage embeddings request failed: HTTP ${String(response.status)} ${await response.text()}`);
  }
  const payload = (await response.json()) as VoyageEmbeddingsResponse;
  return payload.data.map((item) => item.embedding);
};

export { embed, EMBEDDING_MODEL, type VoyageInputType };
