import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ChangeStatus,
  getBatchResults,
  startChangeTrackingBatch
} from "#src/clients/firecrawl.ts";

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

describe("firecrawl batch change tracking", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("starts a batch job with markdown + git-diff changeTracking formats", async () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "fc-test");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, id: "job-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const id = await startChangeTrackingBatch(["https://a.example/pricing"]);
    expect(id).toBe("job-1");
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as Record<string, unknown>;
    expect(body["urls"]).toEqual(["https://a.example/pricing"]);
    expect(JSON.stringify(body["formats"])).toContain("changeTracking");
    expect(JSON.stringify(body["formats"])).toContain("git-diff");
  });

  it("throws when the start response has no job id", async () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "fc-test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: false })));
    await expect(startChangeTrackingBatch(["https://a.example"])).rejects.toThrow(/no job id/u);
  });

  it("maps batch results and follows next pagination", async () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "fc-test");
    const page1 = {
      status: "completed",
      next: "https://api.firecrawl.dev/v2/batch/scrape/job-1?skip=1",
      data: [
        {
          markdown: "# Pricing",
          metadata: { sourceURL: "https://a.example/pricing", title: "Pricing" },
          changeTracking: { changeStatus: "changed", diff: { text: "+ $29" } }
        }
      ]
    };
    const page2 = {
      status: "completed",
      next: null,
      data: [
        {
          markdown: "# News",
          metadata: { sourceURL: "https://b.example/news", title: "News" },
          changeTracking: { changeStatus: "new" }
        }
      ]
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2));
    vi.stubGlobal("fetch", fetchMock);
    const results = await getBatchResults("job-1");
    expect(results.status).toBe("completed");
    expect(results.pages).toHaveLength(2);
    expect(results.pages[0]).toEqual({
      url: "https://a.example/pricing",
      title: "Pricing",
      markdown: "# Pricing",
      changeStatus: ChangeStatus.Changed,
      diffText: "+ $29"
    });
    expect(results.pages[1]?.changeStatus).toBe(ChangeStatus.New);
    expect(results.pages[1]?.diffText).toBe("");
  });

  it("defaults an unknown changeStatus to same (discarded downstream)", async () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "fc-test");
    const payload = {
      status: "completed",
      next: null,
      data: [{ markdown: "x", metadata: { sourceURL: "https://c.example" }, changeTracking: { changeStatus: "weird" } }]
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload)));
    const results = await getBatchResults("job-2");
    expect(results.pages[0]?.changeStatus).toBe(ChangeStatus.Same);
  });

  it("throws on a non-OK status response", async () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "fc-test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 502 })));
    await expect(getBatchResults("job-3")).rejects.toThrow(/502/u);
  });
});
