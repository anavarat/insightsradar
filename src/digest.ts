export type DigestRequest = {
  articleTitle: string;
  articleBody: string;
  rankedKeywords: string[];
};

export type DigestArtifacts = {
  keyworddigest: string;
  level1digest: string[];
  level2digest: {
    conceptsEntities: string[];
    summaryBullets: string[];
    conclusionBullets: string[];
  };
};

export type AttemptTrace = {
  model: string;
  attempt: number;
  ok: boolean;
  error?: string;
};

export type DigestGenerationSuccess = {
  ok: true;
  modelUsed: string;
  attempts: AttemptTrace[];
  artifacts: DigestArtifacts;
};

export type DigestGenerationFailure = {
  ok: false;
  failureReason: string;
  attempts: AttemptTrace[];
};

export type DigestGenerationResult = DigestGenerationSuccess | DigestGenerationFailure;

export type ModelInvoker = (model: string, prompt: string) => Promise<unknown>;

export async function generateDigestsWithFailover(params: {
  request: DigestRequest;
  primaryModel: string;
  fallbackModel: string;
  maxRetriesPerModel?: number;
  invokeModel: ModelInvoker;
}): Promise<DigestGenerationResult> {
  const maxRetriesPerModel = params.maxRetriesPerModel ?? 3;
  const attempts: AttemptTrace[] = [];
  const prompt = buildDigestPrompt(params.request);

  for (const model of [params.primaryModel, params.fallbackModel]) {
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt += 1) {
      try {
        const raw = await params.invokeModel(model, prompt);
        const parsed = parseModelResponse(raw);
        const validated = validateDigestArtifacts(parsed);
        attempts.push({ model, attempt, ok: true });
        return {
          ok: true,
          modelUsed: model,
          attempts,
          artifacts: validated
        };
      } catch (error) {
        attempts.push({
          model,
          attempt,
          ok: false,
          error: toErrorMessage(error)
        });
      }
    }
  }

  return {
    ok: false,
    failureReason: "digest_generation_failed_after_primary_and_fallback",
    attempts
  };
}

function buildDigestPrompt(request: DigestRequest): string {
  return [
    "You generate three digest levels for a Cloudflare blog article.",
    "Return strict JSON only with no markdown fence and no commentary.",
    "JSON shape:",
    '{"keyworddigest":"...","level1digest":["..."],"level2digest":{"conceptsEntities":["..."],"summaryBullets":["..."],"conclusionBullets":["..."]}}',
    "Constraints:",
    "- keyworddigest: one sentence.",
    "- level1digest: 10-12 bullets preferred; valid if non-empty array.",
    "- level2digest must include all three arrays with at least one bullet each.",
    `Title: ${request.articleTitle}`,
    `Ranked keywords: ${request.rankedKeywords.join(", ")}`,
    `Body: ${request.articleBody}`
  ].join("\n");
}

function parseModelResponse(raw: unknown): unknown {
  if (typeof raw === "string") {
    return JSON.parse(raw);
  }

  if (isRecord(raw) && typeof raw.response === "string") {
    return JSON.parse(raw.response);
  }

  if (isRecord(raw) && isRecord(raw.output) && typeof raw.output.text === "string") {
    return JSON.parse(raw.output.text);
  }

  return raw;
}

function validateDigestArtifacts(value: unknown): DigestArtifacts {
  if (!isRecord(value)) {
    throw new Error("digest_schema_invalid_root");
  }

  const keyworddigest = toNonEmptyString(value.keyworddigest, "keyworddigest");
  const level1digest = toNonEmptyStringArray(value.level1digest, "level1digest");

  if (!isRecord(value.level2digest)) {
    throw new Error("digest_schema_invalid_level2digest");
  }

  const conceptsEntities = toNonEmptyStringArray(value.level2digest.conceptsEntities, "level2digest.conceptsEntities");
  const summaryBullets = toNonEmptyStringArray(value.level2digest.summaryBullets, "level2digest.summaryBullets");
  const conclusionBullets = toNonEmptyStringArray(
    value.level2digest.conclusionBullets,
    "level2digest.conclusionBullets"
  );

  return {
    keyworddigest,
    level1digest,
    level2digest: {
      conceptsEntities,
      summaryBullets,
      conclusionBullets
    }
  };
}

function toNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field}_must_be_non_empty_string`);
  }
  return value.trim();
}

function toNonEmptyStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field}_must_be_non_empty_array`);
  }
  const items = value.map((item) => toNonEmptyString(item, field));
  return items;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
