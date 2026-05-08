import { describe, expect, it } from "vitest";
import worker from "../src";
import type { Env } from "../src/config";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    INGESTION_MODE: "product_engineering_only",
    INGESTION_START_DATE: "2026-05-01T00:00:00Z",
    PRIMARY_MODEL: "@cf/moonshotai/kimi-k2-instruct",
    FALLBACK_MODEL: "@cf/meta/llama-3.1-8b-instruct",
    ADMIN_TOKEN: "super-secret-token",
    ...overrides
  };
}

describe("health endpoint", () => {
  it("returns service status and safe config", async () => {
    const req = new Request("https://example.com/health");
    const res = await worker.fetch(req, makeEnv(), {});

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const body = (await res.json()) as {
      status: string;
      service: string;
      timestamp: string;
      config: {
        ingestionMode: string;
        ingestionStartDate: string;
        primaryModel: string;
        fallbackModel: string;
      };
    };

    expect(body.status).toBe("ok");
    expect(body.service).toBe("insightsradar");
    expect(body.timestamp).toBeTypeOf("string");
    expect(body.config.ingestionMode).toBe("product_engineering_only");
    expect(body.config.ingestionStartDate).toBe("2026-05-01T00:00:00Z");
    expect(body.config.primaryModel).toBe("@cf/moonshotai/kimi-k2-instruct");
    expect(body.config.fallbackModel).toBe("@cf/meta/llama-3.1-8b-instruct");
    expect(JSON.stringify(body)).not.toContain("super-secret-token");
  });
});
