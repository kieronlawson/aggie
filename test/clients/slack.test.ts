import { afterEach, describe, expect, it, vi } from "vitest";

import { postMessage, postThreadReply, SlackChannel } from "#src/clients/slack.ts";

const okResponse = (): Response =>
  new Response(JSON.stringify({ ok: true, ts: "123.456" }), {
    headers: { "Content-Type": "application/json" }
  });

const lastRequestBody = (fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> => {
  const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return JSON.parse((call?.[1] as RequestInit).body as string) as Record<string, unknown>;
};

describe("slack client unfurl suppression", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("postMessage disables link and media unfurls", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    await postMessage(SlackChannel.IntelStaging, "hello");
    const body = lastRequestBody(fetchMock);
    expect(body["unfurl_links"]).toBe(false);
    expect(body["unfurl_media"]).toBe(false);
  });

  it("postThreadReply disables link and media unfurls", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    await postThreadReply(SlackChannel.IntelStaging, "123.456", "reply");
    const body = lastRequestBody(fetchMock);
    expect(body["unfurl_links"]).toBe(false);
    expect(body["unfurl_media"]).toBe(false);
    expect(body["thread_ts"]).toBe("123.456");
  });
});
