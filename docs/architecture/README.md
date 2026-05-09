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
