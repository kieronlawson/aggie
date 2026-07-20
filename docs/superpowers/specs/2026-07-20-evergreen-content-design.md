# Evergreen content split — design

Date: 2026-07-20
Status: approved

## Goal

Evergreen vendor/thought-leadership articles (Global Relay how-tos, undated guidance) are not
news: they re-enter the digest as story clusters and "continuing stories" forever. Kieron's
decision: they are "definitely NOT news but still worth reviewing (as links with short
summaries) when they are first indexed."

## Decisions

- Classifier gains `content_kind`: `news` (reports a dated event — enforcement action, rule
  proposal/adoption, court decision, filing, announcement, incident, personnel change) vs
  `evergreen` (undated guidance, how-tos, best-practice explainers, webinars, vendor thought
  leadership — content that would read the same any week). Unsure → `news`.
- Evergreen items are excluded from clustering/synthesis entirely — never in signals, new
  this week, details, or continuing stories.
- Instead they appear ONCE, in the digest covering the week they were indexed, as a
  thread-side `## 📚 Worth a read` section: `- [title](url) — <stored 2-3 sentence summary>`.
  Built in code (not by the synthesis model), appended after the synthesized body.
- Missing `content_kind` (all pre-existing rows) is treated as `news` — the fix is
  forward-looking; old Global Relay rows age out of the 7-day window naturally.
- If a week has only evergreen items, the digest body is just the Worth-a-read section; the
  card degrades to header + pointer via the existing empty-card path.
- Alerts (complaint/outage) unaffected.

## Code changes

- `src/pipeline/types.ts` — `ContentKind` enum; `ClassifyResult.content_kind: ContentKind`.
- `src/pipeline/classify.ts` — schema property (required), system-prompt definition, parse
  with `news` default.
- `src/pipeline/process.ts` — `content_kind` in the upserted row.
- `src/report/generate.ts` — fetch `content_kind`; partition items; synthesize news only;
  exported `worthAReadSection(items)` appended when non-empty.
- Docs: `docs/tuning-log.md` entry; CLAUDE.md pipeline note.

## Testing

Classifier parse defaults and evergreen pass-through; `worthAReadSection` empty/non-empty;
evergreen partition predicate treats missing kind as news; existing fixtures updated for the
new required field. Staging effect is visible only after the next W1 ingest classifies new
items — no forced re-run.

## Out of scope

Reclassifying stored items; per-source kind overrides in the registry (revisit if the
classifier misjudges); the new-feeds research track (separate, sources-v2).
