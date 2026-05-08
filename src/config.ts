export const DEFAULT_INGESTION_START_DATE = "2026-05-01T00:00:00Z";

const VALID_INGESTION_MODES = ["all", "product_engineering_only"] as const;

export type IngestionMode = (typeof VALID_INGESTION_MODES)[number];

export type Env = {
  INGESTION_MODE?: IngestionMode;
  INGESTION_START_DATE?: string;
  PRIMARY_MODEL?: string;
  FALLBACK_MODEL?: string;
  ADMIN_TOKEN?: string;
  BLOG_METADATA_DB?: unknown;
  BLOG_ARTIFACTS_BUCKET?: unknown;
  BLOG_JOB_QUEUE?: unknown;
  AI?: unknown;
};

export type AppConfig = {
  ingestionMode: IngestionMode;
  ingestionStartDate: string;
  primaryModel: string;
  fallbackModel: string;
};

export function loadConfig(env: Env): AppConfig {
  const ingestionMode = env.INGESTION_MODE ?? "product_engineering_only";
  if (!VALID_INGESTION_MODES.includes(ingestionMode)) {
    throw new Error(`INGESTION_MODE must be one of: ${VALID_INGESTION_MODES.join(", ")}`);
  }

  const ingestionStartDate = env.INGESTION_START_DATE ?? DEFAULT_INGESTION_START_DATE;
  if (!isIsoDate(ingestionStartDate)) {
    throw new Error("INGESTION_START_DATE must be a valid ISO-8601 date");
  }

  const primaryModel = requiredString(env.PRIMARY_MODEL, "PRIMARY_MODEL");
  const fallbackModel = requiredString(env.FALLBACK_MODEL, "FALLBACK_MODEL");

  if (primaryModel === fallbackModel) {
    throw new Error("PRIMARY_MODEL and FALLBACK_MODEL must be different");
  }

  return {
    ingestionMode,
    ingestionStartDate,
    primaryModel,
    fallbackModel
  };
}

function isIsoDate(value: string): boolean {
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp);
}

function requiredString(value: string | undefined, key: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}
