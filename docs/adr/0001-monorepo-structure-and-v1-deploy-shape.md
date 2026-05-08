# ADR 0001: Monorepo Structure and v1 Deploy Shape

- Status: Accepted
- Date: 2026-05-09
- Related PRD: `docs/specs/cf-blog-digest-agent-prd.md`
- Related issues: `#7`, `#8`

## Context

The repository currently runs as a single-package Cloudflare Worker codebase. Upcoming UI work (starting with `ArticlesTileView`) introduces a frontend runtime with separate concerns from ingestion, queue processing, and API logic.

Without a structural split, coupling between backend and frontend code would increase, making testing, deployment, and ownership boundaries harder over time.

## Decision

Adopt a monorepo layout with explicit app/package boundaries:

- `apps/worker`: Cloudflare Worker backend (ingestion, queue consumer, API routes)
- `apps/web`: React frontend (tile/summary/detail views)
- `packages/shared`: shared TypeScript contracts/types used across worker and web

Workspace/tooling choice for now:

- Use npm workspaces to minimize migration churn from the current setup.

v1 deployment shape:

- Keep native Worker handlers (no Hono in v1).
- Prefer serving web static assets and API from the Worker in v1 for simpler operations.
- Keep boundaries clean so moving web delivery to Cloudflare Pages later remains straightforward.

Routing and feed-contract details locked during grill-with-docs refinement:

- Route ownership split:
  - `/api/*` stays server-owned for backend APIs.
  - `/health` remains a direct backend route.
  - Other non-API GET routes use SPA fallback to `index.html` (for deep-link support).
- Infinite-scroll data contract uses cursor pagination under the hood:
  - UX remains infinite scroll.
  - API uses opaque cursor pagination for stability (newest-first ordering).
  - Cursor is based on `(published_at, canonical_url)` to avoid offset drift and tie instability.

## Alternatives considered

1. Keep single-package structure at repo root
   - Rejected: low short-term effort but increases cross-runtime coupling and future refactor cost.

2. Move to monorepo with Pages + Worker split immediately
   - Rejected for v1: adds service/deployment complexity too early.

3. Introduce Hono during monorepo migration
   - Rejected for v1: not required for current complexity; keep as v2 option.

## Consequences

Positive:

- Clear ownership and runtime boundaries between UI and backend.
- Faster iteration on web/UI without destabilizing ingestion pipeline.
- Shared contract package reduces API/DTO drift.

Trade-offs:

- One-time repo migration overhead.
- Workspace scripts and paths need updates.

Operational follow-through:

- Slice #7 implementation proceeds only after monorepo structure migration is in place.
- Future ADR can revisit Hono adoption when route/middleware complexity justifies it.
