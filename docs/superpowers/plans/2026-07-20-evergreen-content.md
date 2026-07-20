# Evergreen Content Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify items as `news` vs `evergreen`; keep evergreen out of digest stories and surface it once, on first index, as a `📚 Worth a read` links section.

**Architecture:** New required `content_kind` field flows classifier → item row → report fetch. The report partitions items in code: news goes through the existing cluster/synthesis path; evergreen renders as a code-built section appended after the synthesized body (thread-side, before static sections). Missing field = news.

**Tech Stack:** TypeScript (Node 22 ESM via tsx), Ramda, vitest.

**Spec:** `docs/superpowers/specs/2026-07-20-evergreen-content-design.md`

## Global Constraints

- **spoke-fp style (CI-enforced):** all-`const`, no classes/loops/`if-else`/`switch` (single-if early return allowed), arrow functions with explicit return types, double quotes, semicolons, no trailing commas, ≤120-char lines, enums over string literals.
- **Imports:** `#src/*` subpaths only.
- **Verification:** `npm run check` before every commit.
- **Adding a required field to `ClassifyResult` breaks existing fixtures/tests that construct it** — update them with `content_kind: ContentKind.News` as part of Task 1, not as an afterthought.
- **Classification-behavior changes are logged in `docs/tuning-log.md`** with date and reason.

---

### Task 1: `content_kind` through the pipeline (types, classifier, upsert)

**Files:**
- Modify: `src/pipeline/types.ts`, `src/pipeline/classify.ts`, `src/pipeline/process.ts` (storeItem row)
- Modify: any test/fixture constructing `ClassifyResult` (run the suite to find them; expect `test/pipeline/*.test.ts`)
- Test: `test/pipeline/classify.test.ts` (extend)

**Interfaces:**
- Produces: `ContentKind` enum (`News = "news"`, `Evergreen = "evergreen"`) exported from `#src/pipeline/types.ts`; `ClassifyResult.content_kind: ContentKind`; item rows carry `content_kind`. Task 2 imports `ContentKind` in the report.

- [ ] **Step 1: Write the failing tests**

Add to `test/pipeline/classify.test.ts` (adjust imports to match the file's existing style; it already imports `parseClassifyResult`):

```typescript
import { ContentKind } from "#src/pipeline/types.ts";

describe("content_kind parsing", () => {
  it("passes evergreen through", () => {
    const result = parseClassifyResult(
      JSON.stringify({
        classification: "regulatory",
        sentiment: "",
        title: "T",
        summary: "S",
        entities: [],
        relevant: true,
        content_kind: "evergreen"
      })
    );
    expect(result.content_kind).toBe(ContentKind.Evergreen);
  });

  it("defaults missing or unknown content_kind to news", () => {
    const base = {
      classification: "regulatory",
      sentiment: "",
      title: "T",
      summary: "S",
      entities: [],
      relevant: true
    };
    expect(parseClassifyResult(JSON.stringify(base)).content_kind).toBe(ContentKind.News);
    expect(parseClassifyResult(JSON.stringify({ ...base, content_kind: "blog" })).content_kind).toBe(
      ContentKind.News
    );
  });
});
```

Also assert the prompt/schema surface:

```typescript
it("instructs the news/evergreen distinction", () => {
  expect(SYSTEM_PROMPT).toContain("content_kind=news");
  expect(SYSTEM_PROMPT).toContain("content_kind=evergreen");
  expect(SYSTEM_PROMPT).toContain("dated event");
});
```

(`SYSTEM_PROMPT` is currently module-private in `src/pipeline/classify.ts` — export it.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/pipeline/classify.test.ts`
Expected: FAIL — `ContentKind` and `SYSTEM_PROMPT` not exported; `content_kind` absent from results.

- [ ] **Step 3: Implement**

`src/pipeline/types.ts` — add after the existing enums:

```typescript
enum ContentKind {
  News = "news",
  Evergreen = "evergreen"
}
```

Add to `ClassifyResult`:

```typescript
  /** Evergreen = undated guidance/thought-leadership; excluded from digest stories. */
  content_kind: ContentKind;
```

Export `ContentKind` from the export line.

`src/pipeline/classify.ts`:
- Import `ContentKind`; add `const CONTENT_KINDS: string[] = Object.values(ContentKind);`
- Schema: add `content_kind: { type: "string", enum: CONTENT_KINDS }` to properties and `"content_kind"` to `required`.
- Append to `SYSTEM_PROMPT` (before the final closing quote of the template, as a new trailing section):

```typescript
  "\n\nSet content_kind=news when the item reports a dated event — an enforcement action, rule " +
  "proposal or adoption, court decision, filing, announcement, incident, or personnel change. " +
  "Set content_kind=evergreen for undated guidance, how-tos, best-practice explainers, webinars, " +
  "or vendor thought leadership — content that would read the same whichever week it was " +
  "published. When genuinely unsure, prefer news.";
```

- `parseClassifyResult`: add

```typescript
      content_kind:
        parsed["content_kind"] === ContentKind.Evergreen ? ContentKind.Evergreen : ContentKind.News
```

- Export `SYSTEM_PROMPT`.

`src/pipeline/process.ts` — in `storeItem`'s upsert object, after `relevant`:

```typescript
      content_kind: ctx.classified.content_kind,
```

Fix all fixtures/tests that construct `ClassifyResult` by adding `content_kind: ContentKind.News` (the suite will point at them).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/pipeline` then `npm run check`
Expected: all green (including previously-breaking fixture constructions).

- [ ] **Step 5: Commit**

```bash
git add -A src test docs
git commit -m "Classify items as news vs evergreen content"
```

---

### Task 2: Report partition + Worth-a-read section + docs

**Files:**
- Modify: `src/report/generate.ts`
- Modify: `docs/tuning-log.md`, `CLAUDE.md`
- Test: `test/report/generate.test.ts` (extend)

**Interfaces:**
- Consumes: `ContentKind` from `#src/pipeline/types.ts` (Task 1).
- Produces: exported `worthAReadSection(items: ReportItem[]): string` and `isEvergreen(item: ReportItem): boolean`; `ReportItem.content_kind: string`; `generateDigestBody` synthesizes news-only and appends the section.

- [ ] **Step 1: Write the failing tests**

Add to `test/report/generate.test.ts` (extend the generate import with `isEvergreen, worthAReadSection`; reuse the existing `ITEM` fixture):

```typescript
describe("evergreen handling", () => {
  it("treats missing content_kind as news", () => {
    expect(isEvergreen({ ...ITEM, content_kind: "" })).toBe(false);
    expect(isEvergreen({ ...ITEM, content_kind: "news" })).toBe(false);
    expect(isEvergreen({ ...ITEM, content_kind: "evergreen" })).toBe(true);
  });

  it("renders worth-a-read as linked one-liners", () => {
    const section = worthAReadSection([{ ...ITEM, content_kind: "evergreen" }]);
    expect(section).toContain("## 📚 Worth a read");
    expect(section).toContain("- [FINRA example](https://www.finra.org/media-center/newsreleases/2026/example) — A FINRA thing happened.");
  });

  it("renders nothing when there are no evergreen items", () => {
    expect(worthAReadSection([])).toBe("");
  });
});
```

(The `ITEM` fixture needs `content_kind: ""` added so it satisfies the widened `ReportItem` type.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/report/generate.test.ts`
Expected: FAIL — new exports missing.

- [ ] **Step 3: Implement**

In `src/report/generate.ts`:

- Import `ContentKind` from `#src/pipeline/types.ts`.
- Add `content_kind: string;` to `ReportItem`; add `"content_kind"` to `ITEM_ATTRIBUTES`; add `content_kind: str(row, "content_kind")` to `rowToReportItem`.
- Add:

```typescript
const isEvergreen = (item: ReportItem): boolean => item.content_kind === ContentKind.Evergreen;

const WORTH_A_READ_HEADING = "## 📚 Worth a read";

const worthAReadSection = (items: ReportItem[]): string =>
  items.length === 0
    ? ""
    : [
        WORTH_A_READ_HEADING,
        "",
        ...R.map((item: ReportItem) => `- [${item.title}](${item.url}) — ${item.summary}`, items)
      ].join("\n");
```

- Rework `generateDigestBody` to partition and synthesize news only:

```typescript
const generateDigestBody = async (vertical: Vertical): Promise<GeneratedReport> => {
  const items = await fetchWeekItems(vertical);
  if (items.length === 0) {
    return { body: "", clusters: 0, items: 0 };
  }
  const [evergreen, news] = R.partition(isEvergreen, items);
  const reading = worthAReadSection(evergreen);
  if (news.length === 0) {
    return { body: reading, clusters: 0, items: items.length };
  }
  const clusters = clusterItems(news);
  const summaries = await sequentially(clusters, summarizeCluster);
  const previousBody = await latestReportBody(vertical);
  const synthesized = await askText(
    OPUS_MODEL,
    SYNTHESIS_MAX_TOKENS,
    synthesisPrompt(vertical, summaries, previousBody),
    SYNTHESIS_SYSTEM
  );
  const body = [synthesized, reading].filter((part) => part.length > 0).join("\n\n");
  return { body, clusters: clusters.length, items: items.length };
};
```

- Add `isEvergreen` and `worthAReadSection` to the export line.

Docs:
- `docs/tuning-log.md` — append an entry dated 2026-07-20: added `content_kind` news/evergreen to the classifier; evergreen items excluded from digest stories, surfaced once in "Worth a read"; reason: evergreen vendor content (Global Relay) recurring as pseudo-news in continuing stories.
- `CLAUDE.md` — in the "What exists today" P-pipeline bullet, note items carry `content_kind` (news/evergreen; evergreen surfaces once in the digest's Worth-a-read section, never as stories).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/report/generate.test.ts` then `npm run check`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/report/generate.ts test/report/generate.test.ts docs/tuning-log.md CLAUDE.md
git commit -m "Surface evergreen items once as Worth-a-read, not as stories"
```

---

### Task 3: Deploy

**Files:** none.

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

No staging re-run: stored items lack `content_kind`, so behavior changes only as the next W1 ingest (daily 02:00 UTC) classifies new items; Sunday's digest shows the first Worth-a-read section.

---

## Self-Review

- **Spec coverage:** classifier field + default (Task 1), exclusion from stories + one-time Worth-a-read + only-evergreen-week fallback (Task 2 `generateDigestBody`), missing-field-as-news (both `parseClassifyResult` default and `isEvergreen` on `""`), alerts untouched (no changes to the alert branch), docs (Task 2).
- **Placeholders:** none; complete code shown for every change.
- **Type consistency:** `ContentKind` exported from types (Task 1) and imported in generate (Task 2); `worthAReadSection(items: ReportItem[]): string` matches test usage; `R.partition` returns `[pass, fail]` = `[evergreen, news]` with `isEvergreen` as predicate.
