import { describe, expect, it } from "vitest";
import { extractRankedKeywords } from "../src/keywords";

describe("extractRankedKeywords", () => {
  it("ranks explicit mentions highest and caps to topN", () => {
    const ranked = extractRankedKeywords({
      articleTitle: "Workers AI adds durable object support",
      articleBody:
        "Workers AI now integrates with Durable Objects. Workers AI inference can trigger Queues.",
      categories: ["Product News", "Workers"],
      inferredAreas: ["Cloudflare workers", "workersai", "queue processing"],
      topN: 5
    });

    expect(ranked).toHaveLength(5);
    expect(ranked[0]?.label).toBe("Workers AI");
    expect(ranked.some((k) => k.label === "Durable Objects")).toBe(true);
    expect(ranked.some((k) => k.label === "Queues")).toBe(true);
  });

  it("normalizes aliases to canonical taxonomy and keeps freeform fallback", () => {
    const ranked = extractRankedKeywords({
      articleTitle: "cf workers and cloudflare d1",
      articleBody: "This post covers worker ai patterns and custom billing guardrails.",
      categories: ["developer platform"],
      inferredAreas: ["workersai", "custom billing"],
      topN: 8
    });

    expect(ranked.some((k) => k.label === "Workers")).toBe(true);
    expect(ranked.some((k) => k.label === "D1")).toBe(true);
    expect(ranked.some((k) => k.label === "Workers AI")).toBe(true);
    expect(ranked.some((k) => k.label === "Custom Billing")).toBe(true);
  });

  it("respects maxN ceiling of 8", () => {
    const ranked = extractRankedKeywords({
      articleTitle: "Workers R2 D1 Queues KV Pages CDN WAF Turnstile",
      articleBody: "Workers R2 D1 Queues KV Pages CDN WAF Turnstile and Zero Trust.",
      categories: ["Product", "Engineering", "Security", "Network"],
      inferredAreas: ["workers", "r2", "d1", "api shield", "magic wan", "magic transit"],
      topN: 20,
      maxN: 50
    });

    expect(ranked).toHaveLength(8);
  });
});
