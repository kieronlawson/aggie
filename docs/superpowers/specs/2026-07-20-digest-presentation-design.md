# Digest presentation revamp — design

Date: 2026-07-20
Status: approved

## Goal

The first staged digest with relevance commentary was unreadable in Slack: bare URLs inline,
link-preview cards consuming the channel, seven "no substantive change" bullets, and no entry
point telling readers what they're getting. Rebuild the presentation as a compact channel card
with the depth in the thread, fronted by an LLM-written lead-in in Aggie's voice.

## Decisions

- **Layout:** compact card in channel; everything secondary in the thread (Kieron picked this
  over all-in-channel).
- **Lead-in:** LLM-generated, 1–2 sentences, personality ("Give Aggie some personality!
  Remember we need to engage our audience"). Personality never bends facts.
- **Links:** every link is a markdown `[publisher](url)` link, never a bare URL. `toMrkdwn`
  already converts these to Slack `<url|text>` links.
- **Unfurls:** disabled on all Slack posts (`unfurl_links: false`, `unfurl_media: false`).
- **Continuing stories:** only clusters with actual changes get a sentence; when none changed,
  a single collapsed line `"<N> continuing stories, no changes — <title> · <title> · …"`.

## Message anatomy

**Channel message (card):**
1. Programmatic header: `📡 *Aggie · <vertical> · week of <date>* — <n> items · <n> stories`
2. Lead-in — LLM, no heading, at top of synthesized body.
3. `## ⚡ Signals` — role-tagged one-liners: `<emoji> **<Role>:** <situation> → <action>` +
   story link. Role emoji: 💼 Sales, 📣 Marketing, 🛠️ Product, 👔 Leadership.
4. `## 🆕 New this week` — one bullet per new story: `**<short title>** — <one-line gist>` + link.
5. Static pointer: `🧵 _Full digest in thread →_`

**Thread replies (in order):**
- `## Details` — full story paragraphs with `_Why it matters — **Role:** …_` lines (the
  relevance-commentary rules from the previous spec carry over unchanged).
- `## 🔁 Continuing stories` — changed-only, or the collapsed line.
- `## Competitor sections` — competitor vertical only, unchanged framing.
- `## 🔎 Manual checks` and `## Footer` — statically appended, as today.

## Split mechanism

The synthesis emits ONE markdown document in the section order above. `## Details` is the
split marker: `splitDigest(body)` returns `{ card, thread }` — text before the marker is the
card, marker onward is the thread. If the marker is missing (model misbehaved), `card` is
empty and the whole body goes to the thread — the channel message degrades to header +
pointer, never a broken card. The FULL document (card + thread + static sections) is what
gets upserted to the `reports` namespace, so previous-report context is unchanged.

## Voice

`SYNTHESIS_SYSTEM` gains an Aggie voice block: a sharp, well-read intel analyst who respects
the reader's time — confident, warm, occasionally wry. The lead-in hooks; signals stay punchy;
Details paragraphs stay factual. Hard limits: no invented details, no product hype, links
preserved exactly.

## Code changes

- `src/clients/slack.ts` — `unfurl_links: false, unfurl_media: false` on both post functions.
- `src/report/format.ts` — new `splitDigest`; manual-checks heading becomes `## 🔎 Manual checks`.
- `src/report/generate.ts` — voice block in `SYNTHESIS_SYSTEM`; restructured `synthesisPrompt`
  (lead-in, `## ⚡ Signals`, `## 🆕 New this week`, `## Details`, changed-only
  `## 🔁 Continuing stories`, markdown-link rule); cluster-summary prompt extracted as
  exported `clusterSummaryPrompt` and updated to demand `[publisher](url)` links.
- `src/cli/report.ts` — new header format; card assembly (header + card + pointer);
  `deliverToSlack(card, thread)` posts the card as the channel message and threads the rest.

## Testing

- Unit: `splitDigest` (marker present / absent / text before-and-after), unfurl flags on the
  Slack request body (mocked `fetch`), prompt-content assertions updated for the new section
  contract, `clusterSummaryPrompt` linkify rule.
- Quality: deploy, dispatch W3 for finance with `force=true` (today's report already
  delivered), Kieron eyeballs the card in `#intel-staging`.

## Out of scope

Email delivery, `#intel-digest` promotion (phase gate), Block Kit (plain mrkdwn is enough
until proven otherwise).
