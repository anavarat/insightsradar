import { loadConfig, type Env } from "./config";

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

const worker = {
  fetch(request: Request, env: Env, _ctx?: unknown): Response {
    const { pathname } = new URL(request.url);
    if (pathname === "/health") {
      return health(env);
    }
    return notFound();
  }
};

export default worker;
