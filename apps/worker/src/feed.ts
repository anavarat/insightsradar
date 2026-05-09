export type FeedCursor = {
  publishedAt: string;
  canonicalUrl: string;
};

export function encodeCursor(cursor: FeedCursor): string {
  const json = JSON.stringify(cursor);
  return toBase64Url(json);
}

export function decodeCursor(value: string | null): FeedCursor | null {
  if (!value) {
    return null;
  }

  try {
    const decoded = fromBase64Url(value);
    const parsed = JSON.parse(decoded) as Partial<FeedCursor>;
    if (!parsed.publishedAt || !parsed.canonicalUrl) {
      return null;
    }
    return {
      publishedAt: parsed.publishedAt,
      canonicalUrl: parsed.canonicalUrl
    };
  } catch {
    return null;
  }
}

export function normalizeLimit(value: string | null): number {
  const parsed = Number(value ?? "20");
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 20;
  }
  return Math.min(parsed, 50);
}

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return atob(`${normalized}${"=".repeat(padLength)}`);
}
