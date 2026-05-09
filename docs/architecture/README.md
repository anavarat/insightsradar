# Architecture Diagram Icon Policy

Cloudflare diagram icons in this repository are sourced from:
- `https://github.com/anavarat/cf-architecture-icons`

## Sync Icons

```bash
./scripts/sync-cf-icons.sh
```

Optionally pin to a tag or commit ref:

```bash
./scripts/sync-cf-icons.sh <tag-or-commit-ref>
```

## D2 Usage

Use local vendored icons for Cloudflare nodes:

```d2
Worker: {
  label: "Workers"
  icon: "./icons/cf/workers.svg"
}
```

## Reproducibility

- Prefer pinning icon sync to a tag or commit ref when updating diagrams.
- Keep icon paths local under `docs/architecture/icons/cf/`.

## Diagram Index

Use this quick index to find the right diagram by task.

- `high-level-architecture.d2` / `high-level-architecture.png`
  - System topology, deployment shape, route ownership, and storage/runtime boundaries.
- `sequence-digest-lifecycle.puml` / `sequence-digest-lifecycle.png`
  - End-to-end flow: cron ingest -> queue digest -> D1/R2 -> UI reads.
- `sequence-manual-reprocess.puml` / `sequence-manual-reprocess.png`
  - Manual reprocess admin operation, auth checks, queue enqueue, and terminal states.
- `sequence-manual-backfill.puml` / `sequence-manual-backfill.png`
  - Manual backfill operation from date input through RSS eligibility scan and enqueue.
- `sequence-digest-failover-triage.puml` / `sequence-digest-failover-triage.png`
  - Primary/fallback retry path and operator triage loop for `digest_failed`.
- `sequence-tile-feed-infinite-scroll.puml` / `sequence-tile-feed-infinite-scroll.png`
  - Cursor-based feed pagination behavior behind infinite scroll UI.
- `sequence-summary-detail-read-path.puml` / `sequence-summary-detail-read-path.png`
  - Summary/detail view fetch path including not-found branches.
- `sequence-smoke-validation-loop.puml` / `sequence-smoke-validation-loop.png`
  - Operational smoke-test checklist flow from ingest to rendered UI.

## Render Commands

Regenerate sequence PNGs from PlantUML sources:

```bash
plantuml -tpng "docs/architecture/sequence-*.puml"
```

Regenerate high-level architecture PNG from D2 source with ELK:

```bash
d2 --layout elk "docs/architecture/high-level-architecture.d2" "docs/architecture/high-level-architecture.png"
```
