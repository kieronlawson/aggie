# Digest Relevance Commentary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role-tagged "so what" commentary to the weekly digest — a `## This week's signals` section plus per-cluster "Why it matters" lines — by extending the existing Opus synthesis prompt.

**Architecture:** Pure prompt change in `src/report/generate.ts`: enrich `SYNTHESIS_SYSTEM` with a Spoke grounding block and extend `synthesisPrompt` with the two new instructions. Both constants get exported so unit tests can assert on prompt content. No schema, client, cluster, or mrkdwn changes — the new output is plain markdown the existing `toMrkdwn` converter already handles.

**Tech Stack:** TypeScript (Node 22 ESM, run via `tsx`), Ramda, vitest.

**Spec:** `docs/superpowers/specs/2026-07-20-relevance-commentary-design.md`

## Global Constraints

- **spoke-fp style (CI-enforced):** all-`const`, no classes/loops/`if-else`/`switch`, arrow functions with explicit return types, double quotes, semicolons, no trailing commas, ≤120-char lines, string comparisons via enums/constants.
- **Imports:** `#src/*` subpath imports only — never relative `..` paths.
- **Model output is markdown:** instruct the model to write `**bold**`/`_italic_` markdown; `toMrkdwn` converts `**bold**` → `*bold*` and passes `_italic_` through. Never instruct mrkdwn syntax directly.
- **Verification command:** `npm run check` (lint + typecheck + test) before every commit. Single file: `npx vitest run test/report/generate.test.ts`.
- **Deploy = git push to main.** No other deployment mechanism.
- **Timing (2026-07-20 is a Sunday):** the W3 report cron fires 06:00 UTC. Do NOT run `npm run report` manually today — a manual delivery makes the scheduled run skip (same-day skip). Push before 06:00 UTC and today's scheduled staging run uses the new prompt.

---

### Task 1: Ground `SYNTHESIS_SYSTEM` in Spoke context

**Files:**
- Modify: `src/report/generate.ts:110-113` (the `SYNTHESIS_SYSTEM` constant) and `src/report/generate.ts:185` (export line)
- Test: `test/report/generate.test.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: `SYNTHESIS_SYSTEM: string` exported from `#src/report/generate.ts` (was module-private). Task 2 adds `synthesisPrompt` to the same export line and the same test file.

- [ ] **Step 1: Write the failing test**

Create `test/report/generate.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { SYNTHESIS_SYSTEM } from "#src/report/generate.ts";

describe("SYNTHESIS_SYSTEM", () => {
  it("grounds the model in Spoke's product and verticals", () => {
    expect(SYNTHESIS_SYSTEM).toContain("compliance call recording");
    expect(SYNTHESIS_SYSTEM).toContain("finance, insurance, healthcare");
  });

  it("describes how each reader role uses intel", () => {
    expect(SYNTHESIS_SYSTEM).toContain("Sales:");
    expect(SYNTHESIS_SYSTEM).toContain("Marketing:");
    expect(SYNTHESIS_SYSTEM).toContain("Product:");
    expect(SYNTHESIS_SYSTEM).toContain("Leadership:");
  });

  it("keeps the partner framing", () => {
    expect(SYNTHESIS_SYSTEM).toContain("Theta Lake");
    expect(SYNTHESIS_SYSTEM).toContain("Smarsh");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/report/generate.test.ts`
Expected: FAIL — `SYNTHESIS_SYSTEM` is not exported from `#src/report/generate.ts` (import/type error).

- [ ] **Step 3: Replace the constant and export it**

In `src/report/generate.ts`, replace the existing `SYNTHESIS_SYSTEM` (lines 110–113):

```typescript
const SYNTHESIS_SYSTEM = [
  "You write Aggie, Spoke Phone's internal weekly intel digest. Spoke sells a cloud phone system",
  "with compliance call recording into regulated verticals (finance, insurance, healthcare).",
  "Be factual and concise; plain language; no hype. Preserve source links exactly as given.",
  "",
  "Readers and how each uses intel:",
  "- Sales: talking points for deals in regulated verticals (enforcement actions, recordkeeping rules).",
  "- Marketing: content angles from regulatory changes or competitor gaps.",
  "- Product: roadmap and compliance signals worth building toward.",
  "- Leadership: competitive posture and market shifts.",
  "",
  "Partner-relationship items (Theta Lake, Smarsh) are opportunity, not threat."
].join("\n");
```

Update the export line (line 185) to:

```typescript
export { fetchWeekItems, generateDigestBody, latestReportBody, type ReportItem, SYNTHESIS_SYSTEM, upsertReport };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/report/generate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run full check and commit**

```bash
npm run check
git add src/report/generate.ts test/report/generate.test.ts
git commit -m "Ground digest synthesis system prompt in Spoke reader context"
```

---

### Task 2: Add signals section and per-cluster commentary to `synthesisPrompt`

**Files:**
- Modify: `src/report/generate.ts:115-135` (the `synthesisPrompt` function) and the export line
- Test: `test/report/generate.test.ts` (extend)

**Interfaces:**
- Consumes: `SYNTHESIS_SYSTEM` export shape from Task 1 (same export line).
- Produces: `synthesisPrompt(vertical: Vertical, summaries: string[], previousBody: string): string` exported from `#src/report/generate.ts`. Callers unchanged — `generateDigestBody` already calls it.

- [ ] **Step 1: Write the failing tests**

Append to `test/report/generate.test.ts` (add `synthesisPrompt` to the existing import, plus the `Vertical` import):

```typescript
import { SYNTHESIS_SYSTEM, synthesisPrompt } from "#src/report/generate.ts";
import { Vertical } from "#src/registry/types.ts";

const SUMMARIES = ["FINRA fined a broker-dealer over off-channel texting (https://example.com/finra)."];
const PREVIOUS_BODY = "## New this week\n\nAn older story.";

describe("synthesisPrompt", () => {
  const prompt = synthesisPrompt(Vertical.Finance, SUMMARIES, PREVIOUS_BODY);

  it("orders the sections signals, new this week, continuing", () => {
    const signals = prompt.indexOf("## This week's signals");
    const newThisWeek = prompt.indexOf("## New this week");
    const continuing = prompt.indexOf("## Continuing stories");
    expect(signals).toBeGreaterThanOrEqual(0);
    expect(signals).toBeLessThan(newThisWeek);
    expect(newThisWeek).toBeLessThan(continuing);
  });

  it("caps signals at 2-3 role-tagged bullets with a no-action fallback", () => {
    expect(prompt).toContain("2-3 most actionable");
    expect(prompt).toContain("**<Role>:**");
    expect(prompt).toContain("Nothing requiring action this week.");
  });

  it("asks for per-cluster commentary only when a concrete use exists", () => {
    expect(prompt).toContain("_Why it matters — **<Role>:**");
    expect(prompt).toContain("Omit the line");
    expect(prompt).toContain("worth monitoring");
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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/report/generate.test.ts`
Expected: FAIL — `synthesisPrompt` not exported; after adding the export, the three content assertions (signals section, role tags, commentary rule) still fail against the old prompt.

- [ ] **Step 3: Replace `synthesisPrompt` and export it**

In `src/report/generate.ts`, replace the existing `synthesisPrompt` (lines 115–135):

```typescript
const synthesisPrompt = (vertical: Vertical, summaries: string[], previousBody: string): string =>
  [
    `Write this week's ${vertical} digest in markdown with exactly these sections:`,
    "## This week's signals — the 2-3 most actionable stories, one bullet each formatted " +
      "\"**<Role>:** <what to do with it>\" ending with the story link. Roles: Sales, Marketing, " +
      'Product, Leadership. Write "Nothing requiring action this week." if no story is genuinely actionable.',
    "## New this week — one paragraph per story cluster (use the cluster summaries below; keep their links). " +
      "When a story has a concrete use for a team, end its paragraph with an italic line " +
      "\"_Why it matters — **<Role>:** <one sentence>_\" (multiple role tags allowed). Omit the line for " +
      'marginal stories — never write filler like "worth monitoring".',
    "## Continuing stories — clusters that also appear in the previous digest; one sentence each on what changed. " +
      'Write "None." if there are none.',
    vertical === Vertical.Competitor
      ? "## Competitor sections — one subsection per competitor with announcements, complaints, and signals. " +
        'Frame partner-relationship items (Theta Lake, Smarsh) as opportunity, adding a "Where we fit" line ' +
        "when a coverage gap appears."
      : "",
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

Update the export line to:

```typescript
export {
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
Expected: PASS (8 tests).

- [ ] **Step 5: Run full check and commit**

```bash
npm run check
git add src/report/generate.ts test/report/generate.test.ts
git commit -m "Add signals section and role-tagged commentary to digest synthesis"
```

---

### Task 3: Deploy and verify via the scheduled staging run

**Files:**
- None (push + observation only).

**Interfaces:**
- Consumes: Tasks 1–2 committed on `main`.
- Produces: the new prompt live for the next W3 run.

- [ ] **Step 1: Push to main (this is the deploy)**

```bash
git push origin main
```

- [ ] **Step 2: Verify via the scheduled run — do NOT run `npm run report` manually today**

The W3 cron fires Sunday 06:00 UTC. If the push landed before 06:00 UTC on 2026-07-20, today's scheduled run already uses the new prompt; otherwise the next Sunday's does. A manual run would deliver first and cause the scheduled run to skip (same-day skip), disrupting the acceptance window.

Expected in `#intel-staging` after the run: each vertical's digest starts with `*This week's signals*` (bold line — mrkdwn-converted heading) containing 2–3 role-tagged bullets or "Nothing requiring action this week.", and some (not necessarily all) "New this week" paragraphs end with an italic `_Why it matters — *Role:* …_` line. No commentary boilerplate on marginal stories.

- [ ] **Step 3: Record the outcome**

If commentary reads as filler or signals are padded to 3 when fewer are genuine, tune the prompt wording in a follow-up commit (prompt-only change; no data migration). Digest quality remains the phase-1 gate criterion for Kieron's review.

---

## Self-Review

- **Spec coverage:** signals section (Task 2), per-cluster commentary with omit rule (Task 2), grounding block (Task 1), no schema/client/mrkdwn changes (verified — output is markdown the converter handles), staging verification (Task 3). Out-of-scope Slack density work correctly absent.
- **Placeholders:** none — all steps carry complete code and exact commands.
- **Type consistency:** `synthesisPrompt(vertical, summaries, previousBody)` signature unchanged from the existing call site in `generateDigestBody`; export names match between tasks and tests.
