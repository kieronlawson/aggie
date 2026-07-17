# Aggie tuning log

Every threshold change goes here with the date and the reason. Starting values:

- Dedupe candidate threshold (`DEDUPE_CANDIDATE_THRESHOLD`): **0.90** — embedding similarity above
  which a Haiku duplicate/same_story/distinct comparison runs.
- Alert sentiment threshold (`ALERT_SENTIMENT_THRESHOLD`): **moderate** — minimum complaint
  sentiment that fires an immediate alert.

| Date | Setting | From → To | Reason |
|---|---|---|---|
| 2026-07-17 | — | — | Initial values set at build time; no changes yet. |
