# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Aggie is an internal intel aggregator for Spoke: it collects regulatory news and competitor
intelligence, then delivers weekly Slack/email digests per vertical plus immediate alerts for
complaints and outages. It is being built autonomously by Claude, phase by phase, with Kieron
reviewing at phase gates.

**Current status: phase 3 (W2 crawl) built and deployed — gate acceptance needs a real tracked
page change to appear correctly classified in a digest. Per the plan's 2026-07-24 amendment:
job boards are deferred indefinitely, the competitor digest joins the weekly schedule now, and
phase 4 (insurance/healthcare) is next; the alert branch follows phase 4.** The
source of truth is:

- `docs/2026-07-17-intel-aggregator-spec.md` — approved spec: architecture, data model,
  classification schema, report format, resolved decisions.
- `docs/2026-07-17-intel-aggregator-implementation-plan.md` — build phases 0–5, each with tasks,
  deliverables, and an acceptance test that must pass before the next phase starts. Tasks marked
  **[K]** need Kieron; everything else is autonomous.

Read both documents before doing any build work. Do not skip ahead of the current phase or start
a phase before the previous gate has passed.

## Non-negotiable rules from the plan

- **Load the `spoke-fp` skill before writing any TypeScript.** It encodes Spoke's strict
  functional style (no classes, no loops, no `if/else`/`switch`, Ramda, all-`const`, explicit
  return types) — CI-enforced, so code that violates it is rejected.
- **No logic in workflow YAML.** Each GitHub Actions workflow is a thin shell: checkout →
  setup-node → `npm ci` → one `npm run` command with env from secrets, plus a `workflow_dispatch`
  trigger. Any conditional or data threading belongs in the CLI entrypoint under `src/cli/`.
- **Deploying is a git push.** There is no other deployment mechanism.
- **No secrets in repo contents.** Keys live in GitHub repository secrets
  (`ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `TURBOPUFFER_API_KEY`, `FIRECRAWL_API_KEY`,
  `SLACK_BOT_TOKEN`); a `.env.example` documents the set for local runs.
- **All build-time output posts to `#intel-staging`** until the relevant phase gate promotes it
  to `#intel-digest` / `#competitive-intel`.
- Respect the spec's non-goals: no UI, no auth, no scraping of G2/Capterra/LinkedIn, no real-time
  pipeline, no services beyond Firecrawl, TurboPuffer, GitHub, Anthropic, and Voyage.

## Development

- Commands: `npm run check` (lint + typecheck + test — run before every commit),
  `npm run verify|ingest|crawl|report|registry` (entrypoints; load `.env` if present via
  `--env-file-if-exists`).
- Unit tests cover every pure function (normalize, hash, cluster, canonical selection, dedupe
  verdict handling) against fixtures in `test/fixtures`, and run in CI on every push.
- Failure handling: every entrypoint posts its own failures to Slack with context; ingestion is
  idempotent, so re-running any workflow is always safe. No custom retry logic.
- Threshold changes (dedupe candidate similarity starts at 0.90; alert sentiment starts at
  `moderate`) must be logged in `docs/tuning-log.md` with date and reason.

## Guidelines - MUST FOLLOW
1. **READ BEFORE YOU WRITE**

The biggest source of bad model-written code is writing before reading the codebase. Read the files you are about to touch; read, not skim. Copy the patterns that already exist, and check the imports to see what the project actually depends on, so you do not reach for axios where everything is fetch. When you cannot find a pattern, ask instead of guessing.

2. **THINK BEFORE YOU CODE**

Figure out what you are doing before you type. State your assumptions ("add authentication" is five different things, so name the one you picked) and name the tradeoffs. If something is genuinely confusing, stop and ask rather than filling the gap with plausible-looking code; that is exactly the code that passes a casual review and fails when it matters.

3. **SIMPLICITY**

Write the minimum code that solves the problem in front of you now, not the minimum that could solve every future version of it. Resist premature abstraction, skip error handling for errors that cannot occur, and hardcode values until there is a real reason to configure them. The test: if the only reason something is abstracted is "in case we need to," you have over-built it.

4. **SURGICAL CHANGER**

Your diff should be as small as the task allows. Do not touch what you were not asked to touch, match the existing style, and do not reformat; a formatter pass buries the three lines that matter inside three hundred that do not. The test is whether you can justify every changed line by the task. If a line is there because "while I was in there," revert it.

5. **VERIFICATION**

The gap between code that works and code you think works is testing. When fixing a bug, write the failing test first, watch it fail, then fix it; that is the only proof you fixed the cause and not the symptom. Test behavior that can actually break, not that a constructor sets a field. If something is hard to test, that is information about the design, not permission to skip it.

6. **GOAL-DRIVEN EXECUTION**

Every task needs a success criterion before code is written. "Add validation" becomes "reject a missing or malformed email, return 400 with a clear message, and test both cases." For anything multi-step, state the plan first so the user can catch a wrong approach before you spend an hour building it.

7. **DEBUGGING**

When something breaks, investigate; do not guess. Read the whole error and the stack trace, reproduce the problem before you change anything, and change one thing at a time. Do not paper over an unexpected null with a null check; find out why it is null, or the bug just moves somewhere quieter.

*. **DEPENDENCIES**

Every dependency is permanent code you do not control. Before adding one, ask whether the project or the standard library can already do it with crypto.random() over a uuid package. When you do add one, say why, so the choice is visible rather than smuggled into the manifest.

9. **COMMUNICATION**

Say what you did and why, not just a block of code. Flag concerns even when you did exactly what was asked, and be precise about uncertainty: "I am not sure this library supports streaming" tells the user what to verify; "I think this should work" does not.

10. **COMMON FAILURE MODES**

A few patterns recur often enough to name: the Kitchen Sink (restructuring half the codebase while you are at it), the Wrong Abstraction (copy-paste twice before you abstract), the Optimistic Path (the happy path handled and the 500 ignored), and the Runaway Refactor (a fix that cascades across files). Catch yourself in any of these and the right move is to stop, not to push through.
