# InsightsRadar Operator Runbook (v1)

## Scope

This runbook covers common operations for manual recovery and triage:

- reprocess a single article by canonical URL
- backfill from a given date
- inspect status/failure fields in D1 and logs in Worker output

## Prerequisites

- Access to Cloudflare Worker logs and bindings
- `ADMIN_TOKEN` configured in Worker environment
- API base URL for deployed Worker

## Status model

D1 article records use:

- `pending`
- `processed`
- `digest_failed`

Failure diagnostics:

- `failure_reason`
- `retry_count`
- `model_primary`
- `model_fallback`
- `model_used_final`

## Manual reprocess

Use when a specific article failed or has stale output.

Endpoint:

- `POST /api/admin/reprocess`

Body:

```json
{
  "canonical_url": "https://blog.cloudflare.com/example-post/"
}
```

Auth (one of):

- `x-admin-token: <ADMIN_TOKEN>`
- `Authorization: Bearer <ADMIN_TOKEN>`

Expected outcome:

- response indicates `manual_reprocess` enqueue
- queue consumer logs `digest.start` and terminal `digest.finish`

## Manual backfill

Use when a date range was missed or bootstrap gap must be recovered.

Endpoint:

- `POST /api/admin/backfill`

Body:

```json
{
  "start_date": "2026-05-01T00:00:00Z"
}
```

Auth:

- same as reprocess endpoint

Expected outcome:

- response includes enqueue count
- queued articles run through normal digest pipeline

## Log triage checklist

Look for JSON log events with:

- `phase`: `ingest.start` / `ingest.finish` / `digest.start` / `digest.finish`
- `articleId` (canonical URL)
- `modelPrimary`, `modelFallback`, `modelUsed`
- `outcome`: `processed` or `digest_failed`

If `digest_failed`:

1. check `failure_reason` + `retry_count` in D1
2. reprocess specific URL
3. if repeated, evaluate model behavior and prompt constraints

## Smoke validation loop

For release confidence, run:

1. trigger ingest (cron or manual schedule run)
2. confirm new/changed article enqueued
3. confirm queue processing reaches `processed`
4. open `/` tile feed and verify article appears
5. open summary and detail routes and verify digest content renders
