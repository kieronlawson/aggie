# Relevance commentary in the weekly digest — design

Date: 2026-07-20
Status: approved

## Goal

The digest currently reports what happened; it does not say why a story matters to Spoke or
what a reader should do with it. Add a "so what" layer: role-tagged, action-oriented
commentary, at both the digest level and the story level.

## Decisions

- **Placement:** both levels — a digest-level highlights section plus per-cluster commentary
  lines.
- **Framing:** role-tagged (Sales, Marketing, Product, Leadership); multiple tags allowed on
  one story.
- **Coverage:** commentary only when the model can name a concrete use. Marginal stories stay
  summary-only. No boilerplate ("worth monitoring" is explicitly forbidden — omit instead).
- **Generation:** extend the existing Opus synthesis pass (approach A). No new API calls, no
  schema changes, no re-classification. Rejected alternatives: classifier-time
  `relevance_note` (Haiku quality, schema change, per-item token cost, no week context) and a
  separate post-synthesis pass (extra cost, tone-drift risk, no context advantage).

## Digest format changes

Both verticals' synthesized bodies gain:

1. `## This week's signals` — new first section. The 2–3 most actionable stories, each one
   bullet of the form `*<Role>:* <what to do with it>` plus the story link. If nothing is
   genuinely actionable: `Nothing requiring action this week.`
2. Per-cluster commentary in `## New this week` — after a story's paragraph, an italic line
   `_Why it matters — *Sales:* …_`, emitted only when a concrete use exists.

Manual checks and footer remain statically appended, unchanged.

## Code changes

All in `src/report/generate.ts`:

- `SYNTHESIS_SYSTEM` grows a Spoke grounding block: what Spoke sells (cloud phone system with
  compliance recording, sold into finance/insurance/healthcare), who reads the digest and how
  each role uses intel (Sales → deal talking points in regulated verticals; Marketing →
  content angles; Product → roadmap/compliance signals; Leadership → competitive posture),
  and the existing partner framing for Theta Lake/Smarsh.
- `synthesisPrompt` adds the signals-section instruction and the per-cluster commentary rule,
  including the explicit omit-rather-than-filler instruction.

No changes to schemas, clients, clustering, or mrkdwn conversion — the new content is plain
markdown (bold + italic) that the existing converter already handles.

## Testing

- Unit tests for the new prompt content (grounding block present; sections listed in order;
  commentary instructions present), alongside the existing prompt tests.
- Quality judged by running `npm run report` against `#intel-staging`, within the current
  phase-1 acceptance window; digest quality remains the gate criterion Kieron reviews.

## Risk / rollback

Pure prompt change. If commentary reads as filler in staging, tune or revert the prompt — no
data migration either way.

## Out of scope (follow-up)

Slack presentation improvements — the current mrkdwn rendering is dense; a readability pass
is planned as a separate piece of work after this lands.
