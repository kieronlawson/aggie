import { fetchJson } from "../lib/http.js";
import { nowSeconds, parseDateSeconds } from "../lib/time.js";
import type { FeedEntry } from "./feeds.js";

const GREENHOUSE_HOST = "boards-api.greenhouse.io";
const LEVER_HOST = "api.lever.co";
const MILLIS_PER_SECOND = 1000;

type GreenhouseJob = {
  absolute_url?: string;
  title?: string;
  updated_at?: string;
  content?: string;
  location?: { name?: string };
};

type LeverPosting = {
  hostedUrl?: string;
  text?: string;
  createdAt?: number;
  descriptionPlain?: string;
  categories?: { location?: string; team?: string; commitment?: string };
};

const greenhouseEntry = (job: GreenhouseJob): FeedEntry => ({
  url: job.absolute_url ?? "",
  title: `${job.title ?? "Unknown role"} — ${job.location?.name ?? "Unknown location"}`,
  content: [
    `Job posting: ${job.title ?? ""}`,
    `Location: ${job.location?.name ?? ""}`,
    (job.content ?? "").slice(0, 4000)
  ].join("\n"),
  publishedAt: parseDateSeconds(job.updated_at, nowSeconds())
});

const leverEntry = (posting: LeverPosting): FeedEntry => {
  const { text = "Unknown role", hostedUrl = "", descriptionPlain = "", createdAt } = posting;
  const { location = "Unknown location", team = "" } = posting.categories ?? {};
  return {
    url: hostedUrl,
    title: `${text} — ${location}`,
    content: [
      `Job posting: ${text}`,
      `Location: ${location}`,
      `Team: ${team}`,
      descriptionPlain.slice(0, 4000)
    ].join("\n"),
    publishedAt: createdAt === undefined ? nowSeconds() : Math.floor(createdAt / MILLIS_PER_SECOND)
  };
};

export const fetchJobBoard = async (url: string): Promise<FeedEntry[]> => {
  const host = new URL(url).hostname;
  if (host === GREENHOUSE_HOST) {
    const result = (await fetchJson(url)) as { jobs?: GreenhouseJob[] };
    return (result.jobs ?? []).map(greenhouseEntry).filter((entry) => entry.url !== "");
  }
  if (host === LEVER_HOST) {
    const result = (await fetchJson(url)) as LeverPosting[];
    return (Array.isArray(result) ? result : []).map(leverEntry).filter((entry) => entry.url !== "");
  }
  throw new Error(`Unsupported job board host: ${host}`);
};
