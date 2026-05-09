#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/docs/architecture/icons/cf"
TMP_DIR="$(mktemp -d)"
REPO_URL="https://github.com/anavarat/cf-architecture-icons.git"
PINNED_REF="${1:-main}"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$TARGET_DIR"

echo "Syncing Cloudflare icons from $REPO_URL @ $PINNED_REF"
git clone --depth=1 --branch "$PINNED_REF" "$REPO_URL" "$TMP_DIR/cf-architecture-icons" >/dev/null 2>&1
cp -f "$TMP_DIR/cf-architecture-icons"/icons/cf/*.svg "$TARGET_DIR"/

ICON_COUNT=$(find "$TARGET_DIR" -maxdepth 1 -type f -name '*.svg' | wc -l | tr -d ' ')
echo "Done. Local icon count: $ICON_COUNT"
