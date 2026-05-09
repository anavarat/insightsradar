import { describe, expect, it } from "vitest";
import { isAdminAuthorized, parseCanonicalUrl, parseIsoDate } from "../src/admin";

describe("isAdminAuthorized", () => {
  it("accepts x-admin-token", () => {
    const req = new Request("https://example.com", { headers: { "x-admin-token": "token-123" } });
    expect(isAdminAuthorized(req, "token-123")).toBe(true);
  });

  it("accepts bearer token", () => {
    const req = new Request("https://example.com", { headers: { authorization: "Bearer token-123" } });
    expect(isAdminAuthorized(req, "token-123")).toBe(true);
  });

  it("rejects missing or mismatched token", () => {
    const req = new Request("https://example.com");
    expect(isAdminAuthorized(req, "token-123")).toBe(false);
    expect(isAdminAuthorized(req, undefined)).toBe(false);
  });
});

describe("admin parsers", () => {
  it("parses canonical URL", () => {
    expect(parseCanonicalUrl("https://blog.cloudflare.com/test")).toBe("https://blog.cloudflare.com/test");
    expect(parseCanonicalUrl("bad-url")).toBeNull();
  });

  it("parses ISO date", () => {
    expect(parseIsoDate("2026-05-01T00:00:00Z")).toBe("2026-05-01T00:00:00.000Z");
    expect(parseIsoDate("bad-date")).toBeNull();
  });
});
