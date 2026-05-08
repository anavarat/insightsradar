# Compact Context Baseline

## Snapshot

- Timestamp: 2026-05-09 UTC
- Project: `insightsradar`
- Purpose: Cloudflare Blog Digest Agent + App for developer platform adoption awareness.

## Current Product Contract

- PRD source of truth: `docs/specs/cf-blog-digest-agent-prd.md`.
- Digest artifacts:
  - `keyworddigest`
  - `level1digest`
  - `level2digest`
- Ingestion starts from `2026-05-01T00:00:00Z`.
- Ingestion mode config supports `all` and `product_engineering_only` (default target mode).
- Identity key for articles is canonical Cloudflare blog URL.
- Processing architecture target is hourly cron -> ingest worker -> queue -> digest worker.
- Digest generation uses Workers AI with primary and fallback model strategy.

## Delivery State

- PRD drafted and stored locally.
- Vertical-slice GitHub issues created (#1 to #10).
- Slice #1 (bootstrap worker skeleton and config) is the next implementation target.

## Repo Notes

- ADR pass intentionally deferred at this stage.
- Manual context workflow uses:
  - `meta/compact.md`
  - `meta/compact-delta.md`
  - `meta/compact-delta-commit-map.md`
