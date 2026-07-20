# Digest Presentation Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the weekly digest as a compact, personality-led channel card (lead-in, signals, new stories) with all depth in the thread — named links, no unfurls, collapsed continuing stories.

**Architecture:** Synthesis emits one markdown doc; `## Details` is the card/thread split marker. `splitDigest` (format.ts) cuts it; `report.ts` posts card as the channel message and threads the rest; `slack.ts` disables unfurls. Full doc still upserted to `reports`.

**Tech Stack:** TypeScript (Node 22 ESM via tsx), Ramda, vitest.

**Spec:** `docs/superpowers/specs/2026-07-20-digest-presentation-design.md`

## Global Constraints

- **spoke-fp style (CI-enforced):** all-`const`, no classes/loops/`if-else`/`switch`, arrow functions with explicit return types, double quotes, semicolons, no trailing commas, ≤120-char lines, string comparisons via enums/constants, ≤4 params, at most one throw and one try/catch per function. Test files relax magic-number/string rules only.
- **Imports:** `#src/*` subpath imports only — never relative `..` paths.
- **Model writes markdown**, never Slack mrkdwn: `[text](url)` links, `**bold**`, `_italic_`. `toMrkdwn` converts downstream.
- **Verification:** `npm run check` before every commit. Focused: `npx vitest run <file>`.
- **Deploy = git push to main.** Post-deploy staging run needs `force=true` (today's finance report already delivered).

---

### Task 1: Disable link unfurls in the Slack client

**Files:**
- Modify: `src/clients/slack.ts:35-42`
- Test: `test/clients/slack.test.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: `postMessage`/`postThreadReply` unchanged signatures; every `chat.postMessage` body now carries `unfurl_links: false, unfurl_media: false`.

- [ ] **Step 1: Write the failing test**

Create `test/clients/slack.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/clients/slack.test.ts`
Expected: FAIL — `unfurl_links` is `undefined`, not `false`.

- [ ] **Step 3: Add the flags**

In `src/clients/slack.ts`, replace `postMessage` and `postThreadReply` (lines 35–42):

```typescript
const postMessage = async (channel: SlackChannel, text: string): Promise<string> => {
  const payload = await slackCall("chat.postMessage", { channel, text, unfurl_links: false, unfurl_media: false });
  return payload.ts ?? "";
};

const postThreadReply = async (channel: SlackChannel, threadTs: string, text: string): Promise<void> => {
  await slackCall("chat.postMessage", {
    channel,
    text,
    thread_ts: threadTs,
    unfurl_links: false,
    unfurl_media: false
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/clients/slack.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run full check and commit**

```bash
npm run check
git add src/clients/slack.ts test/clients/slack.test.ts
git commit -m "Disable Slack link unfurls on digest posts"
```

---

### Task 2: Add `splitDigest` and emoji manual-checks heading to format.ts

**Files:**
- Modify: `src/report/format.ts`
- Test: `test/report/format.test.ts` (extend)

**Interfaces:**
- Consumes: nothing new.
- Produces: `splitDigest(body: string): { card: string; thread: string }` and `DETAILS_HEADING` (`"## Details"`) exported from `#src/report/format.ts`. Task 4 calls `splitDigest`; Task 3's prompt must emit exactly `## Details` as the marker heading. Manual-checks heading becomes `## 🔎 Manual checks`.

- [ ] **Step 1: Write the failing tests**

Append to `test/report/format.test.ts` (add `DETAILS_HEADING, splitDigest` to the import from `#src/report/format.ts`):

```typescript
describe("splitDigest", () => {
  it("splits card from thread at the Details heading", () => {
    const body = "Lead-in.\n\n## ⚡ Signals\n\n- bullet\n\n## Details\n\nStory paragraph.\n\n## 🔁 Continuing stories\n\nNone.";
    const { card, thread } = splitDigest(body);
    expect(card).toContain("Lead-in.");
    expect(card).toContain("## ⚡ Signals");
    expect(card).not.toContain("## Details");
    expect(thread.startsWith(DETAILS_HEADING)).toBe(true);
    expect(thread).toContain("## 🔁 Continuing stories");
  });

  it("returns an empty card when the marker is missing", () => {
    const { card, thread } = splitDigest("just a body with no marker");
    expect(card).toBe("");
    expect(thread).toBe("just a body with no marker");
  });

  it("keeps static sections thread-side after appendStaticSections", () => {
    const digest = appendStaticSections("Lead.\n\n## Details\n\nStory.", []);
    const { card, thread } = splitDigest(digest);
    expect(card).not.toContain("Manual checks");
    expect(thread).toContain("## 🔎 Manual checks");
    expect(thread).toContain("## Footer");
  });
});
```

Also update the existing `appendStaticSections` test that asserts `"## Manual checks"` ordering (test/report/format.test.ts:9) to expect `"## 🔎 Manual checks"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/report/format.test.ts`
Expected: FAIL — `splitDigest` not exported; emoji heading absent.

- [ ] **Step 3: Implement**

In `src/report/format.ts`: change the manual-checks heading and add the split. Full new file:

```typescript
import * as R from "ramda";

/** Static reminder list per the spec — these sources cannot be scraped. */
const MANUAL_CHECKS = [
  "G2 reviews: https://www.g2.com/products/ringcentral/reviews | https://www.g2.com/products/8x8/reviews",
  "Capterra: https://www.capterra.com/p/135003/RingCentral/ | https://www.capterra.com/p/121595/8x8/",
  "LinkedIn: competitor company pages and Spoke's ICP hashtags"
];

const appendStaticSections = (body: string, failedSources: string[]): string => {
  const failureLines =
    failedSources.length === 0
      ? ["No source failures this week."]
      : R.map((failure: string) => `- ${failure}`, failedSources);
  return [
    body.trim(),
    "",
    "## 🔎 Manual checks",
    "",
    ...R.map((check: string) => `- ${check}`, MANUAL_CHECKS),
    "",
    "## Footer",
    "",
    ...failureLines
  ].join("\n");
};

/** Marker heading separating the channel card from the thread body. */
const DETAILS_HEADING = "## Details";

type SplitDigest = {
  card: string;
  thread: string;
};

/** Cuts the digest at DETAILS_HEADING; a missing marker degrades to card-less delivery. */
const splitDigest = (body: string): SplitDigest => {
  const markerIndex = body.indexOf(DETAILS_HEADING);
  if (markerIndex === -1) {
    return { card: "", thread: body.trim() };
  }
  return { card: body.slice(0, markerIndex).trim(), thread: body.slice(markerIndex).trim() };
};

export { appendStaticSections, DETAILS_HEADING, MANUAL_CHECKS, splitDigest, type SplitDigest };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/report/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full check and commit**

```bash
npm run check
git add src/report/format.ts test/report/format.test.ts
git commit -m "Add card/thread digest split and emoji manual-checks heading"
```

---

### Task 3: Restructure synthesis prompts — voice, card sections, named links

**Files:**
- Modify: `src/report/generate.ts` (`SYNTHESIS_SYSTEM`, `synthesisPrompt`, `summarizeCluster`, export line)
- Test: `test/report/generate.test.ts` (update + extend)

**Interfaces:**
- Consumes: `DETAILS_HEADING` value contract from Task 2 — the prompt hardcodes the heading text `## Details`.
- Produces: `clusterSummaryPrompt(cluster: ReportItem[]): string` newly exported; `SYNTHESIS_SYSTEM` and `synthesisPrompt` keep their exported signatures with new content. `synthesisPrompt` section order: lead-in (no heading), `## ⚡ Signals`, `## 🆕 New this week`, `## Details`, `## 🔁 Continuing stories`, competitor ternary, closing rules.

- [ ] **Step 1: Update and extend the tests**

In `test/report/generate.test.ts`, add `clusterSummaryPrompt` to the import from `#src/report/generate.ts`, add a `ReportItem`-shaped fixture, and replace the existing `synthesisPrompt` describe block with:

```typescript
const ITEM = {
  id: "item:abc",
  story_id: "story:1",
  vector: [],
  url: "https://www.finra.org/media-center/newsreleases/2026/example",
  title: "FINRA example",
  summary: "A FINRA thing happened.",
  classification: "regulatory",
  competitor: "",
  relationship: "regulatory",
  published_at: "2026-07-18",
  merged_urls: []
};

describe("SYNTHESIS_SYSTEM voice", () => {
  it("defines Aggie's voice with factual guardrails", () => {
    expect(SYNTHESIS_SYSTEM).toContain("voice");
    expect(SYNTHESIS_SYSTEM).toContain("wry");
    expect(SYNTHESIS_SYSTEM).toContain("no invented details");
  });
});

describe("clusterSummaryPrompt", () => {
  it("demands markdown publisher links, never bare URLs", () => {
    const prompt = clusterSummaryPrompt([ITEM]);
    expect(prompt).toContain("[publisher name](url)");
    expect(prompt).toContain("never a bare URL");
    expect(prompt).toContain("A FINRA thing happened.");
  });
});

describe("synthesisPrompt", () => {
  const prompt = synthesisPrompt(Vertical.Finance, SUMMARIES, PREVIOUS_BODY);

  it("orders sections lead-in, signals, new, details, continuing", () => {
    const lead = prompt.indexOf("Lead-in");
    const signals = prompt.indexOf("## ⚡ Signals");
    const newThisWeek = prompt.indexOf("## 🆕 New this week");
    const details = prompt.indexOf("## Details");
    const continuing = prompt.indexOf("## 🔁 Continuing stories");
    expect(lead).toBeGreaterThanOrEqual(0);
    expect(lead).toBeLessThan(signals);
    expect(signals).toBeLessThan(newThisWeek);
    expect(newThisWeek).toBeLessThan(details);
    expect(details).toBeLessThan(continuing);
  });

  it("keeps signals role-tagged with emoji and a no-action fallback", () => {
    expect(prompt).toContain("💼 Sales");
    expect(prompt).toContain("📣 Marketing");
    expect(prompt).toContain("🛠️ Product");
    expect(prompt).toContain("👔 Leadership");
    expect(prompt).toContain("Nothing requiring action this week.");
  });

  it("keeps per-cluster commentary with the omit rule", () => {
    expect(prompt).toContain("_Why it matters — **<Role>:**");
    expect(prompt).toContain("Omit the line");
    expect(prompt).toContain("never write filler");
  });

  it("collapses unchanged continuing stories to a single line", () => {
    expect(prompt).toContain("no changes —");
    expect(prompt).toContain('Write "None." if there are no continuing stories.');
  });

  it("forbids bare URLs in the synthesis output", () => {
    expect(prompt).toContain("markdown link");
  });

  it("includes competitor sections only for the competitor vertical", () => {
    expect(prompt).not.toContain("## Competitor sections");
    const competitorPrompt = synthesisPrompt(Vertical.Competitor, SUMMARIES, PREVIOUS_BODY);
    expect(competitorPrompt).toContain("## Competitor sections");
  });

  it("threads the summaries and previous digest through", () => {
    expect(prompt).toContain("- FINRA fined a broker-dealer");
    expect(prompt).toContain("An older story.");
  });
});
```

Keep the existing `SYNTHESIS_SYSTEM` grounding describe block (product, roles, partner framing) unchanged.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/report/generate.test.ts`
Expected: FAIL — `clusterSummaryPrompt` not exported; new section headings and voice text absent.

- [ ] **Step 3: Implement**

In `src/report/generate.ts`:

Replace `SYNTHESIS_SYSTEM` with:

```typescript
const SYNTHESIS_SYSTEM = [
  "You write Aggie, Spoke Phone's internal weekly intel digest. Spoke sells a cloud phone system",
  "with compliance call recording into regulated verticals (finance, insurance, healthcare).",
  "",
  "Readers and how each uses intel:",
  "- Sales: talking points for deals in regulated verticals (enforcement actions, recordkeeping rules).",
  "- Marketing: content angles from regulatory changes or competitor gaps.",
  "- Product: roadmap and compliance signals worth building toward.",
  "- Leadership: competitive posture and market shifts.",
  "",
  "Partner-relationship items (Theta Lake, Smarsh) are opportunity, not threat.",
  "",
  "Aggie's voice: a sharp, well-read intel analyst who respects the reader's time — confident,",
  "warm, occasionally wry. The lead-in should hook; signals stay punchy; Details paragraphs stay",
  "plain and factual. Personality never bends facts: no invented details, no product hype, and",
  "every link is preserved exactly as given, always as a markdown link [text](url), never a bare URL."
].join("\n");
```

Replace `summarizeCluster` with an exported prompt builder plus the call:

```typescript
const clusterSummaryPrompt = (cluster: ReportItem[]): string =>
  [
    "Summarize this cluster of related intel items as ONE tight paragraph for an internal digest.",
    "End the paragraph with the canonical source links in parentheses, primary link first, each",
    "written as a markdown link [publisher name](url) — e.g. [FINRA.org](https://www.finra.org/...)",
    "— never a bare URL.",
    "",
    ...R.map(clusterLine, cluster)
  ].join("\n");

const summarizeCluster = async (cluster: ReportItem[]): Promise<string> =>
  askText(HAIKU_MODEL, SUMMARY_MAX_TOKENS, clusterSummaryPrompt(cluster));
```

Replace `synthesisPrompt` with:

```typescript
const synthesisPrompt = (vertical: Vertical, summaries: string[], previousBody: string): string =>
  [
    `Write this week's ${vertical} digest in markdown with exactly these parts, in order:`,
    "Lead-in — 1-2 sentences at the very top, no heading, in Aggie's voice: the week's sharpest " +
      "takeaway as a hook that makes the reader want the rest.",
    "## ⚡ Signals — the 2-3 most actionable stories, one bullet each formatted " +
      "\"<emoji> **<Role>:** <situation> → <what to do about it>\" ending with the story link. " +
      "Roles and emoji: 💼 Sales, 📣 Marketing, 🛠️ Product, 👔 Leadership. One line per bullet. " +
      'Write "Nothing requiring action this week." if no story is genuinely actionable.',
    "## 🆕 New this week — one bullet per new story cluster: \"**<short title>** — <one-line gist>\" " +
      "ending with the story link. One line each; the full paragraphs belong in Details.",
    "## Details — one paragraph per story cluster (use the cluster summaries below; keep their links). " +
      "When a story has a concrete use for a team, end its paragraph with an italic line " +
      "\"_Why it matters — **<Role>:** <one sentence>_\" (multiple role tags allowed). Omit the line for " +
      "marginal stories — never write filler.",
    "## 🔁 Continuing stories — ONLY clusters that also appear in the previous digest AND have something " +
      "new; one sentence each on what changed. If continuing stories exist but none changed, write a " +
      "single line: \"<N> continuing stories, no changes — <title> · <title> · …\". " +
      'Write "None." if there are no continuing stories.',
    vertical === Vertical.Competitor
      ? "## Competitor sections — one subsection per competitor with announcements, complaints, and signals. " +
        'Frame partner-relationship items (Theta Lake, Smarsh) as opportunity, adding a "Where we fit" line ' +
        "when a coverage gap appears."
      : "",
    "Every link in your output must be a markdown link [text](url) — never a bare URL. " +
      "Do not add any other sections (manual checks and footer are appended automatically).",
    "",
    "### Cluster summaries (this week)",
    ...R.map((summary: string) => `- ${summary}`, summaries),
    "",
    "### Previous digest",
    previousBody.length > 0 ? previousBody : "(none — this is the first digest)"
  ]
    .filter((line) => line.length > 0)
    .join("\n");
```

Update the export line to add `clusterSummaryPrompt`:

```typescript
export {
  clusterSummaryPrompt,
  fetchWeekItems,
  generateDigestBody,
  latestReportBody,
  type ReportItem,
  SYNTHESIS_SYSTEM,
  synthesisPrompt,
  upsertReport
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/report/generate.test.ts`
Expected: PASS. (The old "compliance call recording" grounding tests must still pass — the product/roles/partner lines are retained above.)

- [ ] **Step 5: Run full check and commit**

```bash
npm run check
git add src/report/generate.ts test/report/generate.test.ts
git commit -m "Restructure synthesis prompts: Aggie voice, card sections, named links"
```

---

### Task 4: Card/thread delivery in the report CLI

**Files:**
- Modify: `src/cli/report.ts`

**Interfaces:**
- Consumes: `splitDigest` from Task 2 (`#src/report/format.ts`); unchanged `generateDigestBody`, `appendStaticSections`, `chunkForSlack`, `toMrkdwn`, `postMessage`, `postThreadReply`.
- Produces: no exports (CLI entrypoint). No unit tests — `npm run check` (lint + typecheck) gates; behavior verified in staging (Task 5).

- [ ] **Step 1: Implement**

In `src/cli/report.ts`:

Add `splitDigest` to the format import:

```typescript
import { appendStaticSections, splitDigest } from "#src/report/format.ts";
```

Replace `deliverToSlack` (lines 34–40) with:

```typescript
const CARD_POINTER = "🧵 _Full digest in thread →_";

const deliverToSlack = async (card: string, thread: string): Promise<void> => {
  const cardChunks = chunkForSlack(toMrkdwn(card));
  const threadChunks = chunkForSlack(toMrkdwn(thread));
  const [first, ...cardOverflow] = cardChunks;
  const threadTs = await postMessage(SlackChannel.IntelStaging, first ?? "");
  await sequentially([...cardOverflow, ...threadChunks], async (chunk) => {
    await postThreadReply(SlackChannel.IntelStaging, threadTs, chunk);
  });
};
```

In `main`, replace the digest/header/delivery block (lines 60–64) with:

```typescript
  const digest = appendStaticSections(generated.body, []);
  const { card, thread } = splitDigest(digest);
  const header =
    `📡 *Aggie · ${vertical} · week of ${reportDate}* — ` +
    `${String(generated.items)} items · ${String(generated.clusters)} stories`;
  const cardText = [header, card, CARD_POINTER].filter((part) => part.length > 0).join("\n\n");
  await deliverToSlack(cardText, thread);
```

(`upsertReport(vertical, reportDate, digest)` stays as-is — the full document is stored.)

- [ ] **Step 2: Run full check**

Run: `npm run check`
Expected: lint, typecheck, and all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/cli/report.ts
git commit -m "Deliver digest as compact channel card with depth in thread"
```

---

### Task 5: Deploy and staging re-run

**Files:** none (push + workflow dispatch).

**Interfaces:**
- Consumes: Tasks 1–4 on `main`.

- [ ] **Step 1: Push to main (deploy)**

```bash
git push origin main
```

- [ ] **Step 2: Re-run finance in staging with force**

```bash
gh workflow run w3-report.yml -f vertical=finance -f force=true
gh run watch <run-id> --exit-status
```

`force=true` is required — today's finance report was already delivered; the re-run regenerates and re-posts.

- [ ] **Step 3: Confirm the card in #intel-staging**

Expected channel message: `📡 *Aggie · finance · week of 2026-07-20* — …` header, a 1–2 sentence lead-in with voice, `⚡ Signals` one-liners with role emoji and named links (no bare URLs, no unfurl cards), `🆕 New this week` one-liners, `🧵 Full digest in thread →`. Thread: Details paragraphs with "Why it matters" lines, collapsed continuing-stories line, manual checks, footer. Kieron reviews for approachability.

---

## Self-Review

- **Spec coverage:** unfurls (Task 1), split + emoji heading (Task 2), voice/lead-in/signals/new/collapsed-continuing/named-links prompts (Task 3), card assembly + delivery (Task 4), staging verification (Task 5). Graceful no-marker degradation implemented in Task 2 and exercised by test.
- **Placeholders:** none — complete code in every code step.
- **Type consistency:** `splitDigest` returns `{ card, thread }` consumed identically in Task 4; `clusterSummaryPrompt(cluster: ReportItem[])` matches `summarizeCluster`'s existing input; `deliverToSlack(card, thread)` call site updated with it.
