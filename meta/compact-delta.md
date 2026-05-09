# Compact Delta

Current state:
- Reset after latest compaction refresh
- Add new entries below in this format:

## YYYY-MM-DD HH:MM TZ
- Change:
- Files:
- Validation:

## 2026-05-09 01:41 AEST
- Change: Bootstrapped slice #1 Cloudflare Worker baseline with validated config contract, primary/fallback model failover config fields, and `/health` endpoint returning safe operational config.
- Files: `meta/compact.md`, `meta/compact-delta.md`, `meta/compact-delta-commit-map.md`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `wrangler.toml`, `src/config.ts`, `src/index.ts`, `tests/config.test.ts`, `tests/health.test.ts`, `package-lock.json`.
- Validation: `npm test` (7 tests passed), `npm run typecheck` (pass).

## 2026-05-09 01:49 AEST
- Change: Implemented slice #2 hourly ingestion path with cron trigger, Cloudflare RSS discovery, eligibility filtering by start date and ingestion mode, canonical URL dedupe, and D1 upsert persistence baseline.
- Files: `src/ingest.ts`, `src/repository.ts`, `src/index.ts`, `src/config.ts`, `tests/ingest.test.ts`, `wrangler.toml`, `meta/compact-delta.md`.
- Validation: `npm test` (12 tests passed), `npm run typecheck` (pass), `npx wrangler deploy --dry-run` (pass with bindings).

## 2026-05-09 02:27 AEST
- Change: Implemented slice #3 update detection and queue enqueue flow by comparing per-article content hash against stored D1 hashes, enqueuing only new/changed canonical URLs.
- Files: `src/ingest.ts`, `src/repository.ts`, `src/index.ts`, `src/config.ts`, `tests/ingest.test.ts`, `meta/compact-delta.md`.
- Validation: `npm test` (13 tests passed), `npm run typecheck` (pass), `npx wrangler deploy --dry-run` (pass with bindings).

## 2026-05-09 02:41 AEST
- Change: Implemented slice #4 keyword extraction and normalization pipeline with canonical taxonomy mapping, hybrid explicit/inferred/category signals, ranked top-N output, and metadata persistence into D1.
- Files: `src/keywords.ts`, `tests/keywords.test.ts`, `src/ingest.ts`, `src/repository.ts`, `tests/ingest.test.ts`, `meta/compact-delta.md`.
- Validation: `npm test` (16 tests passed), `npm run typecheck` (pass), `npx wrangler deploy --dry-run` (pass with bindings).

## 2026-05-09 02:47 AEST
- Change: Implemented slice #5 Workers AI digest generation with primary/fallback failover, schema validation, retry logic (3 per model), and queue-consumer status updates for `processed` and `digest_failed` outcomes.
- Files: `src/digest.ts`, `tests/digest.test.ts`, `src/index.ts`, `src/repository.ts`, `src/config.ts`, `meta/compact-delta.md`.
- Validation: `npm test` (19 tests passed), `npm run typecheck` (pass), `npx wrangler deploy --dry-run` (pass with bindings).

## 2026-05-09 02:56 AEST
- Change: Implemented slice #6 artifact persistence by storing source and digest payloads in R2, recording D1 metadata for R2 keys/model fields/status, and tracking word counts for article plus all digest levels.
- Files: `src/artifacts.ts`, `tests/artifacts.test.ts`, `src/index.ts`, `src/repository.ts`, `src/config.ts`, `meta/compact-delta.md`.
- Validation: `npm test` (22 tests passed), `npm run typecheck` (pass), `npx wrangler deploy --dry-run` (pass with bindings).

## 2026-05-09 03:07 AEST
- Change: Added ADR-0001 to formalize monorepo target structure (`apps/worker`, `apps/web`, `packages/shared`) and v1 deploy shape (native Worker handlers, no Hono in v1).
- Files: `docs/adr/0001-monorepo-structure-and-v1-deploy-shape.md`, `meta/compact-delta.md`.
- Validation: ADR reviewed against PRD and slice dependency context for #7 and #8.

## 2026-05-09 03:36 AEST
- Change: Refined ADR-0001 from grill outcomes by explicitly recording SPA fallback route ownership and infinite-scroll backing contract with opaque cursor pagination based on `(published_at, canonical_url)`.
- Files: `docs/adr/0001-monorepo-structure-and-v1-deploy-shape.md`, `meta/compact-delta.md`.
- Validation: Confirmed consistency with PRD FR-9 (`ArticlesTileView` infinite scroll) and API contract section for cursor-based feed pagination.

## 2026-05-09 03:47 AEST
- Change: Implemented prep issue #11 monorepo migration by moving backend runtime to `apps/worker`, scaffolding React+Vite router app in `apps/web`, adding `packages/shared` contracts package, and enabling npm workspaces with cross-workspace scripts.
- Files: `package.json`, `package-lock.json`, `apps/worker/**`, `apps/web/**`, `packages/shared/**`, `meta/compact-delta.md`.
- Validation: `npm test` (all workspaces pass, worker 22 tests pass), `npm run typecheck` (all workspaces pass), `npm run build:web` (pass), `npm run -w @insightsradar/worker dry-run` (pass with assets + bindings).

## 2026-05-09 11:04 AEST
- Change: Implemented slice #7 `ArticlesTileView` with React infinite scroll and added `/api/articles` cursor feed API (opaque cursor by `(published_at, canonical_url)`), with Worker SPA fallback for non-API GET routes.
- Files: `apps/worker/src/index.ts`, `apps/worker/src/repository.ts`, `apps/worker/src/feed.ts`, `apps/worker/src/config.ts`, `apps/worker/tests/feed.test.ts`, `apps/web/src/main.tsx`, `apps/web/src/styles.css`, `apps/web/package.json`, `package-lock.json`, `meta/compact-delta.md`.
- Validation: `npm test` (all workspaces pass; worker 26 tests), `npm run typecheck` (all workspaces pass), `npm run build:web` (pass), `npm run -w @insightsradar/worker dry-run` (pass with assets + bindings).

## 2026-05-10 01:21 AEST
- Change: Implemented slice #8 summary/detail flow by adding `/api/articles/summary` and `/api/articles/detail` endpoints plus React `ArticleSummaryView` and `ArticleDetailView` with bidirectional navigation and scrollable detailed section.
- Files: `apps/worker/src/index.ts`, `apps/worker/src/repository.ts`, `apps/web/src/main.tsx`, `apps/web/src/styles.css`, `packages/shared/src/index.ts`, `meta/compact-delta.md`.
- Validation: `npm test` (all workspaces pass; worker 26 tests), `npm run typecheck` (all workspaces pass), `npm run build:web` (pass), `npm run -w @insightsradar/worker dry-run` (pass with assets + bindings).
