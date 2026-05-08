import { describe, expect, it } from "vitest";
import { DEFAULT_INGESTION_START_DATE, loadConfig, type Env } from "../src/config";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    INGESTION_MODE: "all",
    PRIMARY_MODEL: "@cf/meta/llama-3.1-8b-instruct",
    FALLBACK_MODEL: "@cf/mistral/mistral-7b-instruct-v0.2",
    ...overrides
  };
}

describe("loadConfig", () => {
  it("accepts valid ingestion mode values", () => {
    expect(loadConfig(makeEnv({ INGESTION_MODE: "all" })).ingestionMode).toBe("all");
    expect(loadConfig(makeEnv({ INGESTION_MODE: "product_engineering_only" })).ingestionMode).toBe(
      "product_engineering_only"
    );
  });

  it("rejects invalid ingestion mode", () => {
    expect(() => loadConfig(makeEnv({ INGESTION_MODE: "invalid" as Env["INGESTION_MODE"] }))).toThrow(
      "INGESTION_MODE must be one of"
    );
  });

  it("uses default ingestion start date when unset", () => {
    const cfg = loadConfig(makeEnv({ INGESTION_START_DATE: undefined }));
    expect(cfg.ingestionStartDate).toBe(DEFAULT_INGESTION_START_DATE);
  });

  it("rejects invalid ingestion start date", () => {
    expect(() => loadConfig(makeEnv({ INGESTION_START_DATE: "not-a-date" }))).toThrow(
      "INGESTION_START_DATE must be a valid ISO-8601 date"
    );
  });

  it("requires primary and fallback models", () => {
    expect(() => loadConfig(makeEnv({ PRIMARY_MODEL: "" }))).toThrow("PRIMARY_MODEL is required");
    expect(() => loadConfig(makeEnv({ FALLBACK_MODEL: "" }))).toThrow("FALLBACK_MODEL is required");
  });

  it("requires distinct primary and fallback models", () => {
    expect(() =>
      loadConfig(
        makeEnv({
          PRIMARY_MODEL: "@cf/test/model-a",
          FALLBACK_MODEL: "@cf/test/model-a"
        })
      )
    ).toThrow("PRIMARY_MODEL and FALLBACK_MODEL must be different");
  });
});
