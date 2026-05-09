# InsightsRadar

InsightsRadar is a Cloudflare-native blog intelligence app for developer platform adoption.

It continuously watches Cloudflare blog updates, generates multi-level digests with Workers AI, stores artifacts in R2, indexes metadata in D1, and serves a React UI for fast read paths from tiles -> summary -> detail.

## Why this exists

Cloudflare weekly mailers are useful but dense. InsightsRadar reduces reading friction by turning each eligible post into:

- `keyworddigest` (1-line intro)
- `level1digest` (high-level bullet summary)
- `level2digest` (detailed structured digest)

This lets you scan quickly, then drill down only where it matters.

## Product narrative (end-to-end)

1. **Ingest**: hourly Cron triggers the Worker ingest flow.
2. **Discover + Filter**: Worker fetches Cloudflare RSS and applies start-date and mode filters.
3. **Detect changes**: canonical URLs are hash-compared to identify new/changed posts.
4. **Enqueue**: eligible items are queued for digest processing.
5. **Generate**: queue consumer uses Workers AI with primary/fallback model failover.
6. **Persist**:
   - R2 stores source + digest artifacts.
   - D1 stores status, retries, model path, word counts, and lookup metadata.
7. **Read UI**:
   - `ArticlesTileView` uses cursor-backed infinite scroll.
   - Summary/detail views fetch per-article payloads via API.
8. **Operate**: admin endpoints support manual reprocess and backfill recovery.

## Architecture at a glance

- **Monorepo apps**
  - `apps/worker`: ingestion, queue consumer, API, assets serving.
  - `apps/web`: React + Router UI.
  - `packages/shared`: shared contracts/types.
- **Cloudflare services**
  - Workers, Queues, D1, R2, Workers AI.

See diagrams:

- High-level architecture: `docs/architecture/high-level-architecture.d2`
- High-level rendered: `docs/architecture/high-level-architecture.png`
- Sequence diagrams index: `docs/architecture/README.md`

## Repository layout

```text
.
├── apps/
│   ├── worker/
│   └── web/
├── packages/
│   └── shared/
├── docs/
│   ├── adr/
│   ├── architecture/
│   ├── operations/
│   └── specs/
└── meta/
```

## Key behavior contracts

- Article identity is canonical URL.
- Feed ordering is newest-first with stable cursor tuple semantics.
- Route ownership:
  - `/api/*` backend
  - `/api/admin/*` token-protected backend
  - `/health` backend
  - other GET routes -> SPA fallback (`index.html`)
- Digest generation policy:
  - primary model retries (3)
  - fallback model retries (3)
  - then `digest_failed`

## Local development

### Prerequisites

- Node.js 20+
- npm
- Wrangler CLI (workspace dependency in `apps/worker`)
- PlantUML + Graphviz (for sequence diagram rendering)
- D2 CLI (for high-level architecture rendering)

### Install

```bash
npm install
```

### Validate

```bash
npm test
npm run typecheck
npm run build:web
npm run -w @insightsradar/worker dry-run
```

## Operations

Manual recovery endpoints:

- `POST /api/admin/reprocess`
- `POST /api/admin/backfill`

See operator procedures:

- `docs/operations/operator-runbook.md`

## Documentation map

- PRD: `docs/specs/cf-blog-digest-agent-prd.md`
- ADRs: `docs/adr/`
- Architecture: `docs/architecture/`
- Context log: `meta/compact.md`, `meta/compact-delta.md`

## Current implementation status

Completed slices include:

- worker/bootstrap
- ingestion + change detection
- keyword extraction
- digest generation + failover
- artifact persistence + metadata
- tile feed + infinite scroll
- summary/detail views
- admin controls
- baseline ops visibility + runbook

Refer to GitHub issues and `meta/compact-delta.md` for timestamped execution history.
