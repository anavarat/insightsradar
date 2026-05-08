import { describe, expect, it } from "vitest";
import { buildArtifactKeys, computeWordCounts, countWords } from "../src/artifacts";

describe("artifact helpers", () => {
  it("builds deterministic R2 keys from canonical URL", () => {
    const keys = buildArtifactKeys("https://blog.cloudflare.com/workers-ai-update/");
    expect(keys.sourceKey).toBe("articles/blog-cloudflare-com-workers-ai-update/source.json");
    expect(keys.level1Key).toBe("articles/blog-cloudflare-com-workers-ai-update/level1digest.json");
    expect(keys.level2Key).toBe("articles/blog-cloudflare-com-workers-ai-update/level2digest.json");
    expect(keys.processingKey).toBe("articles/blog-cloudflare-com-workers-ai-update/processing.json");
  });

  it("computes word counts for article and digests", () => {
    const counts = computeWordCounts({
      articleBody: "Cloudflare Workers AI ships model updates",
      keyworddigest: "Workers AI model updates simplify app deployment.",
      level1digest: ["Point one", "Point two"],
      level2digest: {
        conceptsEntities: ["Workers AI", "R2"],
        summaryBullets: ["Summary alpha", "Summary beta"],
        conclusionBullets: ["Conclusion gamma"]
      }
    });

    expect(counts.article).toBe(6);
    expect(counts.keyworddigest).toBe(7);
    expect(counts.level1digest).toBe(4);
    expect(counts.level2digest).toBeGreaterThan(0);
  });

  it("handles empty strings in countWords", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});
