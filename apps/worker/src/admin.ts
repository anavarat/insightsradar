export function isAdminAuthorized(request: Request, configuredToken: string | undefined): boolean {
  if (!configuredToken || configuredToken.trim().length === 0) {
    return false;
  }

  const direct = request.headers.get("x-admin-token");
  if (direct === configuredToken) {
    return true;
  }

  const auth = request.headers.get("authorization");
  if (!auth) {
    return false;
  }
  const bearerPrefix = "Bearer ";
  if (!auth.startsWith(bearerPrefix)) {
    return false;
  }
  return auth.slice(bearerPrefix.length) === configuredToken;
}

export function parseCanonicalUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.toString();
  } catch {
    return null;
  }
}

export function parseIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp).toISOString();
}
