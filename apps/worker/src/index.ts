import { isAdminAuthorized, parseCanonicalUrl, parseIsoDate } from "./admin";
import { loadConfig, type Env } from "./config";
import { persistArtifacts } from "./artifacts";
import { generateDigestsWithFailover } from "./digest";
import { normalizeLimit } from "./feed";
import { filterEligibleArticles, parseCloudflareRss, runIngestion } from "./ingest";
import { D1ArticleRepository } from "./repository";

type HealthResponse = {
  status: "ok";
  service: "insightsradar";
  timestamp: string;
  config: {
    ingestionMode: string;
    ingestionStartDate: string;
    primaryModel: string;
    fallbackModel: string;
  };
};

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function health(env: Env): Response {
  const cfg = loadConfig(env);
  const body: HealthResponse = {
    status: "ok",
    service: "insightsradar",
    timestamp: new Date().toISOString(),
    config: {
      ingestionMode: cfg.ingestionMode,
      ingestionStartDate: cfg.ingestionStartDate,
      primaryModel: cfg.primaryModel,
      fallbackModel: cfg.fallbackModel
    }
  };

  return json(body);
}

function notFound(): Response {
  return json({ error: "Not Found" }, { status: 404 });
}

async function listArticles(request: Request, env: Env): Promise<Response> {
  if (!env.BLOG_METADATA_DB) {
    return json({ error: "BLOG_METADATA_DB binding is required" }, { status: 500 });
  }

  const repository = new D1ArticleRepository(env.BLOG_METADATA_DB);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limit = normalizeLimit(url.searchParams.get("limit"));
  const feed = await repository.listArticleTiles({ cursor, limit });
  return json(feed);
}

async function adminReprocess(request: Request, env: Env): Promise<Response> {
  if (!env.BLOG_JOB_QUEUE) {
    return json({ error: "BLOG_JOB_QUEUE binding is required" }, { status: 500 });
  }
  if (!isAdminAuthorized(request, env.ADMIN_TOKEN)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { canonical_url?: unknown; canonicalUrl?: unknown } | null;
  const canonicalUrl = parseCanonicalUrl(body?.canonical_url ?? body?.canonicalUrl);
  if (!canonicalUrl) {
    return json({ error: "canonical_url must be a valid URL" }, { status: 400 });
  }

  await env.BLOG_JOB_QUEUE.send({ canonicalUrl, reason: "manual_reprocess" });
  return json({ enqueued: 1, canonicalUrl, reason: "manual_reprocess" });
}

async function adminBackfill(request: Request, env: Env): Promise<Response> {
  if (!env.BLOG_JOB_QUEUE) {
    return json({ error: "BLOG_JOB_QUEUE binding is required" }, { status: 500 });
  }
  if (!isAdminAuthorized(request, env.ADMIN_TOKEN)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { start_date?: unknown; startDate?: unknown } | null;
  const startDate = parseIsoDate(body?.start_date ?? body?.startDate);
  if (!startDate) {
    return json({ error: "start_date must be a valid ISO date" }, { status: 400 });
  }

  const config = loadConfig(env);
  const response = await fetch("https://blog.cloudflare.com/rss/");
  if (!response.ok) {
    return json({ error: `Failed to fetch Cloudflare RSS: ${response.status}` }, { status: 502 });
  }
  const xml = await response.text();
  const discovered = parseCloudflareRss(xml);
  const eligible = filterEligibleArticles(discovered, { ...config, ingestionStartDate: startDate });

  const deduped = new Map<string, true>();
  for (const article of eligible) {
    deduped.set(article.canonicalUrl, true);
  }
  for (const canonicalUrl of deduped.keys()) {
    await env.BLOG_JOB_QUEUE.send({ canonicalUrl, reason: "manual_backfill" });
  }

  return json({ enqueued: deduped.size, eligible: eligible.length, startDate, reason: "manual_backfill" });
}

async function getArticleSummary(request: Request, env: Env): Promise<Response> {
  if (!env.BLOG_METADATA_DB) {
    return json({ error: "BLOG_METADATA_DB binding is required" }, { status: 500 });
  }
  const articleId = new URL(request.url).searchParams.get("id");
  if (!articleId) {
    return json({ error: "id is required" }, { status: 400 });
  }
  const repository = new D1ArticleRepository(env.BLOG_METADATA_DB);
  const summary = await repository.getArticleSummary(articleId);
  if (!summary) {
    return json({ error: "Article not found" }, { status: 404 });
  }
  return json(summary);
}

async function getArticleDetail(request: Request, env: Env): Promise<Response> {
  if (!env.BLOG_METADATA_DB) {
    return json({ error: "BLOG_METADATA_DB binding is required" }, { status: 500 });
  }
  const articleId = new URL(request.url).searchParams.get("id");
  if (!articleId) {
    return json({ error: "id is required" }, { status: 400 });
  }
  const repository = new D1ArticleRepository(env.BLOG_METADATA_DB);
  const detail = await repository.getArticleDetail(articleId);
  if (!detail) {
    return json({ error: "Article not found" }, { status: 404 });
  }
  return json(detail);
}

async function ingest(env: Env): Promise<void> {
  if (!env.BLOG_METADATA_DB) {
    throw new Error("BLOG_METADATA_DB binding is required");
  }
  if (!env.BLOG_JOB_QUEUE) {
    throw new Error("BLOG_JOB_QUEUE binding is required");
  }

  const config = loadConfig(env);
  const repository = new D1ArticleRepository(env.BLOG_METADATA_DB);

  await runIngestion({
    config,
    repository,
    queue: env.BLOG_JOB_QUEUE,
    discover: async () => {
      const response = await fetch("https://blog.cloudflare.com/rss/");
      if (!response.ok) {
        throw new Error(`Failed to fetch Cloudflare RSS: ${response.status}`);
      }

      const xml = await response.text();
      return parseCloudflareRss(xml);
    }
  });
}

async function processDigestQueueMessage(
  env: Env,
  message: { canonicalUrl: string; reason: "new" | "changed" | "manual_reprocess" | "manual_backfill" }
): Promise<void> {
  if (!env.BLOG_METADATA_DB) {
    throw new Error("BLOG_METADATA_DB binding is required");
  }
  if (!env.AI) {
    throw new Error("AI binding is required");
  }
  if (!env.BLOG_ARTIFACTS_BUCKET) {
    throw new Error("BLOG_ARTIFACTS_BUCKET binding is required");
  }

  const config = loadConfig(env);
  const repository = new D1ArticleRepository(env.BLOG_METADATA_DB);
  const article = await repository.getArticleForDigest(message.canonicalUrl);
  if (!article) {
    return;
  }

  const rankedKeywords = safeKeywords(article.keywordsJson);
  const generation = await generateDigestsWithFailover({
    request: {
      articleTitle: article.title,
      articleBody: "",
      rankedKeywords
    },
    primaryModel: config.primaryModel,
    fallbackModel: config.fallbackModel,
    invokeModel: async (model, prompt) =>
      env.AI!.run(model, {
        messages: [{ role: "user", content: prompt }]
      })
  });

  if (generation.ok) {
    const persisted = await persistArtifacts({
      bucket: env.BLOG_ARTIFACTS_BUCKET,
      canonicalUrl: message.canonicalUrl,
      articleTitle: article.title,
      articleBody: "",
      rankedKeywords,
      artifacts: generation.artifacts,
      modelPrimary: config.primaryModel,
      modelFallback: config.fallbackModel,
      modelUsedFinal: generation.modelUsed,
      attempts: generation.attempts
    });

    await repository.markDigestSuccess({
      canonicalUrl: message.canonicalUrl,
      modelPrimary: config.primaryModel,
      modelFallback: config.fallbackModel,
      modelUsedFinal: generation.modelUsed,
      retryCount: generation.attempts.length - 1,
      artifacts: generation.artifacts,
      wordCountArticle: persisted.wordCounts.article,
      wordCountKeyworddigest: persisted.wordCounts.keyworddigest,
      wordCountLevel1digest: persisted.wordCounts.level1digest,
      wordCountLevel2digest: persisted.wordCounts.level2digest,
      r2SourceKey: persisted.keys.sourceKey,
      r2Level1Key: persisted.keys.level1Key,
      r2Level2Key: persisted.keys.level2Key
    });
    return;
  }

  const modelUsedFinal = generation.attempts[generation.attempts.length - 1]?.model ?? config.fallbackModel;
  await repository.markDigestFailure({
    canonicalUrl: message.canonicalUrl,
    failureReason: generation.failureReason,
    modelUsedFinal,
    retryCount: generation.attempts.length,
    attemptsJson: JSON.stringify(generation.attempts)
  });
}

function safeKeywords(keywordsJson: string): string[] {
  try {
    const parsed = JSON.parse(keywordsJson) as Array<{ label?: string }>;
    return parsed.map((item) => item.label).filter((label): label is string => typeof label === "string");
  } catch {
    return [];
  }
}

const worker = {
  async fetch(request: Request, env: Env, _ctx?: unknown): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/health") {
      return health(env);
    }
    if (pathname === "/api/articles" && request.method === "GET") {
      return listArticles(request, env);
    }
    if (pathname === "/api/articles/summary" && request.method === "GET") {
      return getArticleSummary(request, env);
    }
    if (pathname === "/api/articles/detail" && request.method === "GET") {
      return getArticleDetail(request, env);
    }
    if (pathname === "/api/admin/reprocess" && request.method === "POST") {
      return adminReprocess(request, env);
    }
    if (pathname === "/api/admin/backfill" && request.method === "POST") {
      return adminBackfill(request, env);
    }

    if (request.method === "GET" && env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
      const fallbackUrl = new URL(request.url);
      fallbackUrl.pathname = "/index.html";
      fallbackUrl.search = "";
      return env.ASSETS.fetch(new Request(fallbackUrl.toString(), request));
    }

    return notFound();
  },
  async scheduled(_event: unknown, env: Env, _ctx: { waitUntil: (p: Promise<unknown>) => void }): Promise<void> {
    await ingest(env);
  },
  async queue(
    batch: { messages: Array<{ body: { canonicalUrl: string; reason: "new" | "changed" | "manual_reprocess" | "manual_backfill" } }> },
    env: Env
  ): Promise<void> {
    for (const message of batch.messages) {
      await processDigestQueueMessage(env, message.body);
    }
  }
};

export default worker;
