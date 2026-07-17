import { describe, expect, it } from "vitest";

import { parseFeedXml } from "#src/clients/feeds.ts";

const MALFORMED_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Feed with bad entities</title>
    <item>
      <title>Smith & Jones fined</title>
      <link>https://example.com/a?x=1&y=2</link>
      <description>Records & retention &amp; more</description>
    </item>
  </channel>
</rss>`;

describe("parseFeedXml with malformed entities", () => {
  it("recovers from unescaped ampersands (as seen in the SEC admin-proceedings feed)", async () => {
    const entries = await parseFeedXml(MALFORMED_RSS);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toBe("Smith & Jones fined");
    expect(entries[0]?.link).toBe("https://example.com/a?x=1&y=2");
  });
});
