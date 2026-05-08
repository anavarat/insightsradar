import { describe, expect, it } from "vitest";
import { generateDigestsWithFailover } from "../src/digest";

function validPayload() {
  return JSON.stringify({
    keyworddigest: "Workers AI and R2 updates simplify platform workflows.",
    level1digest: ["Point 1", "Point 2"],
    level2digest: {
      conceptsEntities: ["Workers AI", "R2"],
      summaryBullets: ["Summary point"],
      conclusionBullets: ["Conclusion point"]
    }
  });
}

describe("generateDigestsWithFailover", () => {
  it("uses primary model when schema is valid", async () => {
    const result = await generateDigestsWithFailover({
      request: {
        articleTitle: "Workers update",
        articleBody: "Body",
        rankedKeywords: ["Workers", "R2"]
      },
      primaryModel: "primary",
      fallbackModel: "fallback",
      invokeModel: async () => validPayload()
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.modelUsed).toBe("primary");
      expect(result.attempts).toHaveLength(1);
      expect(result.artifacts.keyworddigest.length).toBeGreaterThan(0);
    }
  });

  it("switches to fallback after primary retry exhaustion", async () => {
    const calls: string[] = [];

    const result = await generateDigestsWithFailover({
      request: {
        articleTitle: "Workers update",
        articleBody: "Body",
        rankedKeywords: ["Workers", "R2"]
      },
      primaryModel: "primary",
      fallbackModel: "fallback",
      invokeModel: async (model) => {
        calls.push(model);
        if (model === "primary") {
          return "{\"bad\":true}";
        }
        return validPayload();
      }
    });

    expect(result.ok).toBe(true);
    expect(calls.filter((x) => x === "primary")).toHaveLength(3);
    expect(calls.filter((x) => x === "fallback")).toHaveLength(1);
    if (result.ok) {
      expect(result.modelUsed).toBe("fallback");
    }
  });

  it("marks failure after primary and fallback both exhaust retries", async () => {
    const result = await generateDigestsWithFailover({
      request: {
        articleTitle: "Workers update",
        articleBody: "Body",
        rankedKeywords: ["Workers", "R2"]
      },
      primaryModel: "primary",
      fallbackModel: "fallback",
      invokeModel: async () => "{\"bad\":true}"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureReason).toBe("digest_generation_failed_after_primary_and_fallback");
      expect(result.attempts).toHaveLength(6);
      expect(result.attempts.every((a) => a.ok === false)).toBe(true);
    }
  });
});
