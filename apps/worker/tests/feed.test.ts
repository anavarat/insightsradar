import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, normalizeLimit } from "../src/feed";

describe("feed cursor", () => {
  it("round-trips cursor encode/decode", () => {
    const encoded = encodeCursor({
      publishedAt: "2026-05-09T00:00:00.000Z",
      canonicalUrl: "https://blog.cloudflare.com/demo"
    });
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual({
      publishedAt: "2026-05-09T00:00:00.000Z",
      canonicalUrl: "https://blog.cloudflare.com/demo"
    });
  });

  it("returns null for invalid cursor", () => {
    expect(decodeCursor("bad-cursor")).toBeNull();
  });
});

describe("normalizeLimit", () => {
  it("uses default for invalid values", () => {
    expect(normalizeLimit(null)).toBe(20);
    expect(normalizeLimit("bad")).toBe(20);
    expect(normalizeLimit("0")).toBe(20);
  });

  it("caps high limits to 50", () => {
    expect(normalizeLimit("500")).toBe(50);
  });
});
