import { loadConfig, type Env } from "./config";
import { parseCloudflareRss, runIngestion } from "./ingest";
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

const worker = {
  fetch(request: Request, env: Env, _ctx?: unknown): Response {
    const { pathname } = new URL(request.url);
    if (pathname === "/health") {
      return health(env);
    }
    return notFound();
  },
  async scheduled(_event: unknown, env: Env, _ctx: { waitUntil: (p: Promise<unknown>) => void }): Promise<void> {
    await ingest(env);
  }
};

export default worker;
