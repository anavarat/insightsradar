# PRD: Cloudflare Blog Digest Agent + App (v1)

## Document Control

- Owner: Developer Platform Adoption
- Status: Draft for approval
- Version: v1
- Last Updated: 2026-05-09

## 1. Problem Statement

Weekly consolidated Cloudflare blog mailers are high-friction to consume end-to-end. This delays awareness of product and engineering updates that affect developer platform adoption work. The system needs to detect newly published or updated Cloudflare blog posts, produce layered digests, and present them in a fast scan-to-deep-read workflow.

## 2. Goals and Success Criteria

### Goals

- Detect relevant Cloudflare blog changes quickly.
- Generate three digest levels per article (`keyworddigest`, `level1digest`, `level2digest`).
- Store source and generated artifacts in Cloudflare-native storage.
- Provide a simple reading UI with infinite-scroll discovery and two detail depths.

### Success Criteria

- New eligible article is discovered within one scheduled cycle (hourly) plus processing latency.
- Each eligible article has all three digest outputs or a visible failure state.
- Tile feed supports infinite scroll and opens summary and detailed views.
- Word-count metadata is recorded for source and all digest levels.

## 3. Scope

### In Scope (v1)

- Ingestion start date: `2026-05-01T00:00:00Z` onward.
- Configurable ingestion mode:
  - `all`
  - `product_engineering_only` (default)
- Auto-detect and auto-reprocess changed articles.
- Hybrid keyword extraction (explicit mentions plus inferred areas).
- Keyword normalization with canonical taxonomy first, freeform fallback.
- Top keyword ranking with default top 5 and configurable max 8.
- Digest generation via Workers AI (single model in v1).
- Schema validation with retry up to 3 times.
- Cloudflare storage stack:
  - R2 for article and digest artifacts
  - D1 for metadata and UI query index
- UI views:
  - `ArticlesTileView`
  - `ArticleSummaryView`
  - `ArticleDetailView`
- Manual operations endpoints:
  - Reprocess by canonical URL
  - Backfill from date

### Out of Scope (v1)

- Multi-user support and authentication.
- Search and filtering UX in feed.
- Notification channels (Slack/email/webhooks).
- Editorial review workflow.
- Advanced analytics dashboards.

## 4. Ubiquitous Language (DDD)

- `ArticleTitle`: Same title as on Cloudflare blog.
- `keyworddigest`: One-line intro created from ranked keywords conveying key article idea.
- `level1digest`: 10-12 bullet high-level digest (summary plus conclusion).
- `level2digest`: Detailed digest that must include concepts/entities, bulleted summary, and bulleted conclusion.
- `ArticlesTileView`: Infinite-scroll tile list with article title and `keyworddigest`.
- `ArticleSummaryView`: Intermediate detail view with `keyworddigest` and `level1digest`.
- `ArticleDetailView`: Detailed view with `keyworddigest` and `level2digest` in a scrollable section.

## 5. Users and Primary Use Cases

### Primary User

- Single internal user (no auth in v1).

### Core Use Cases

- As a user, I can see newly processed Cloudflare articles in a tile feed, newest first.
- As a user, I can click a tile and read a concise high-level digest.
- As a user, I can navigate to a detailed digest for deeper understanding.
- As an operator, I can reprocess a failed or changed article by URL.
- As an operator, I can backfill ingestion from a specific date.

## 6. Functional Requirements

### FR-1 Ingestion Schedule and Selection

- System runs hourly via Cron Trigger.
- System discovers articles from Cloudflare blog.
- System includes only posts at or after `2026-05-01T00:00:00Z`.
- System applies ingestion mode filter (`all` or `product_engineering_only`).

### FR-2 Identity and Idempotency

- Canonical article URL is the unique identity key.
- Repeated ingestion events for same URL must not create duplicates.

### FR-3 Update Handling

- If a previously processed article is updated upstream, system auto-reprocesses and overwrites digest outputs.

### FR-4 Keyword Extraction and Ranking

- System extracts product and area keywords using:
  - Explicit mentions from title/body.
  - Inferred areas from model analysis.
- System normalizes tags to canonical taxonomy when available.
- System keeps fallback freeform tags when canonical mapping is unavailable.
- System ranks keywords by relevance and stores top N (default 5, configurable max 8).

### FR-5 Digest Generation

- System generates exactly three digest artifacts per article:
  - `keyworddigest` (single-line intro).
  - `level1digest` (10-12 bullets; summary plus conclusion).
  - `level2digest` (detailed with required sections).
- System uses one Workers AI model with prompt variants by digest type.
- Soft bounds apply to output lengths; no hard rejection solely for size.

### FR-6 Validation, Retry, and Failure States

- System validates model output against JSON schema.
- On schema/quality failure, system retries up to 3 attempts.
- After retries exhausted, status becomes `digest_failed` with failure reason.

### FR-7 Metadata and Word Counts

- System records word counts for:
  - Original article content
  - `keyworddigest`
  - `level1digest`
  - `level2digest`

### FR-8 Storage

- R2 stores source article payload and digest artifacts.
- D1 stores metadata index for listing, linking, and status tracking.
- `keyworddigest` is stored in D1 for fast tile rendering.

### FR-9 UI Behavior

#### `ArticlesTileView`

- Infinite scroll feed.
- Newest-first order.
- Responsive layout:
  - Desktop: two columns.
  - Mobile: one column.
- Tile content:
  - `ArticleTitle`
  - `keyworddigest`
- Clicking tile opens `ArticleSummaryView`.

#### `ArticleSummaryView`

- Shows:
  - Link to `ArticlesTileView` (Main)
  - Link to `ArticleDetailView` (Detailed View)
  - `ArticleTitle`
  - `keyworddigest`
  - `level1digest`

#### `ArticleDetailView`

- Shows:
  - Link to `ArticlesTileView` (Main)
  - Link to `ArticleSummaryView` (Summary View)
  - `ArticleTitle`
  - `keyworddigest`
  - `level2digest`
- `level2digest` container must be scrollable.

### FR-10 Manual Operability

- Token-protected internal endpoints for:
  - Reprocess by canonical URL.
  - Backfill from specified date.

## 7. Non-Functional Requirements

- Freshness: eligible updates reflected within <= 1 hour plus processing time.
- Reliability: queue-based decoupling between ingestion and digest generation.
- Resilience: failed digest jobs are observable and retry-bounded.
- Performance: incremental feed loading; avoid full dataset fetch on initial load.
- Security (v1): no end-user auth; protect admin endpoints via secret token.
- Maintainability: configurable ingestion mode and keyword count cap.

## 8. Architecture Overview

### Execution Flow

- Cron Trigger (hourly)
- Ingest Worker (discover/filter/change-detect)
- Cloudflare Queue (article jobs)
- Digest Worker (fetch/extract/generate/validate/store)
- D1 (metadata index) and R2 (artifact storage)

### Rationale

- Prevents long-running cron jobs.
- Isolates failures between crawl and generation.
- Supports scale-out processing with queued jobs.

## 9. Data Model (Proposed)

### D1 Table: `articles`

- `id` (internal primary key)
- `canonical_url` (unique)
- `title`
- `published_at`
- `updated_at`
- `first_seen_at`
- `last_processed_at`
- `ingestion_mode`
- `status` (`pending`, `processed`, `digest_failed`)
- `failure_reason` (nullable)
- `retry_count`
- `keywords_json` (ranked keywords plus optional scores)
- `keyworddigest`
- `word_count_article`
- `word_count_keyworddigest`
- `word_count_level1digest`
- `word_count_level2digest`
- `content_hash`
- `r2_source_key`
- `r2_level1_key`
- `r2_level2_key`

### R2 Keying Convention (Example)

- `articles/{id}/source.json`
- `articles/{id}/level1digest.json`
- `articles/{id}/level2digest.json`
- `articles/{id}/processing.json`

## 10. API Contract (Proposed)

- `GET /api/articles?cursor=<cursor>&limit=<n>`
  - Returns tile payload and next cursor for infinite scroll.
- `GET /api/articles/:id/summary`
- `GET /api/articles/:id/detail`
- `POST /api/admin/reprocess`
  - Body: `{ canonical_url: string }`
  - Requires admin token.
- `POST /api/admin/backfill`
  - Body: `{ start_date: string }`
  - Requires admin token.

## 11. State and Processing Rules

- Unique identity is canonical URL.
- Ingest worker enqueues job when article is new or content hash changed.
- Digest worker writes success/failure state to D1.
- Successful run overwrites prior digest artifacts for same article.

## 12. Acceptance Criteria

- Hourly ingestion discovers eligible posts from configured start date.
- Ingestion mode is configurable between `all` and `product_engineering_only`.
- Each processed article has all three digest artifacts and metadata counts.
- Tile feed is infinite-scroll and newest-first.
- Tile click opens summary view; summary links to detail; detail links back.
- Detailed view renders scrollable `level2digest` section.
- Updated source article is auto-reprocessed and outputs overwritten.
- Schema-failure path retries up to 3 times then marks `digest_failed`.
- Manual reprocess and backfill endpoints operate with token protection.

## 13. Risks and Mitigations

- Category classification mismatch with Cloudflare blog metadata.
  - Mitigation: configurable category allowlist and explicit mode switch.
- LLM output inconsistency.
  - Mitigation: strict schema validation plus bounded retries.
- No-auth v1 exposure for admin operations.
  - Mitigation: secret-token protection and non-public admin route surface.

## 14. Assumptions

- Cloudflare blog provides stable canonical URLs and parsable timestamps.
- Workers AI model selected is sufficient for all three digest levels in v1.
- Single-user operation is acceptable for initial deployment.

## 15. Future Enhancements (Post-v1)

- Search by title and digest content.
- Filter chips by keyword and date.
- Multi-user auth and personalization.
- Digest version history and diff view.
- Alerting integrations for new article summaries.
