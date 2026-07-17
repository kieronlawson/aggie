# Tuning log

Every change to a tuning threshold, with date and reason. Current values:

| Threshold | Where | Value |
|---|---|---|
| Dedupe candidate similarity (layer 2) | `src/pipeline/process.ts` `DEDUPE_SIMILARITY_THRESHOLD` | 0.90 |
| Alert sentiment (complaint/outage) | arrives in phase 2 | `moderate` (planned) |
| Report cluster similarity | `src/report/cluster.ts` `CLUSTER_SIMILARITY_THRESHOLD` | 0.85 |

## Changes

- 2026-07-17 — Initial values set per spec: dedupe 0.90, alert `moderate` (phase 2). Report
  cluster threshold chosen at 0.85 (below the dedupe threshold so distinct-but-related items can
  share a digest cluster without being merge candidates).
