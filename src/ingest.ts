import type { AppConfig } from "./config";

export type DiscoveredArticle = {
  canonicalUrl: string;
  title: string;
  publishedAt: string;
  categories: string[];
};

export type ArticleRecord = {
  canonicalUrl: string;
  title: string;
  publishedAt: string;
  categoriesJson: string;
};

export type ArticleRepository = {
  upsertMany(records: ArticleRecord[]): Promise<number>;
};

export type IngestionStats = {
  discovered: number;
  eligible: number;
  upserted: number;
};

export async function runIngestion(params: {
  config: AppConfig;
  repository: ArticleRepository;
  discover: () => Promise<DiscoveredArticle[]>;
}): Promise<IngestionStats> {
  const discovered = await params.discover();
  const eligible = filterEligibleArticles(discovered, params.config);
  const deduped = dedupeByCanonicalUrl(eligible);
  const records = deduped.map((article) => ({
    canonicalUrl: article.canonicalUrl,
    title: article.title,
    publishedAt: article.publishedAt,
    categoriesJson: JSON.stringify(article.categories)
  }));

  const upserted = await params.repository.upsertMany(records);

  return {
    discovered: discovered.length,
    eligible: deduped.length,
    upserted
  };
}

export function filterEligibleArticles(articles: DiscoveredArticle[], config: AppConfig): DiscoveredArticle[] {
  const startTime = Date.parse(config.ingestionStartDate);
  return articles.filter((article) => {
    const publishedTime = Date.parse(article.publishedAt);
    if (Number.isNaN(publishedTime) || publishedTime < startTime) {
      return false;
    }

    if (config.ingestionMode === "all") {
      return true;
    }

    return article.categories.some((c) => isProductEngineeringCategory(c));
  });
}

export function parseCloudflareRss(xml: string): DiscoveredArticle[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items
    .map((item) => {
      const canonicalUrl = decodeXml(readTag(item, "link"));
      const title = decodeXml(readTag(item, "title"));
      const publishedAt = readTag(item, "pubDate");
      const categories = readTags(item, "category").map((c) => decodeXml(c.trim())).filter(Boolean);

      if (!canonicalUrl || !title || !publishedAt) {
        return null;
      }

      return {
        canonicalUrl,
        title,
        publishedAt: new Date(publishedAt).toISOString(),
        categories
      } satisfies DiscoveredArticle;
    })
    .filter((x): x is DiscoveredArticle => x !== null);
}

function readTag(input: string, tag: string): string {
  const match = input.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

function readTags(input: string, tag: string): string[] {
  const matches = input.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi")) ?? [];
  return matches.map((m) => readTag(m, tag));
}

function dedupeByCanonicalUrl(articles: DiscoveredArticle[]): DiscoveredArticle[] {
  const seen = new Set<string>();
  const result: DiscoveredArticle[] = [];
  for (const article of articles) {
    if (seen.has(article.canonicalUrl)) {
      continue;
    }
    seen.add(article.canonicalUrl);
    result.push(article);
  }
  return result;
}

function isProductEngineeringCategory(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("product") ||
    normalized.includes("developer") ||
    normalized.includes("engineering") ||
    normalized.includes("workers") ||
    normalized.includes("ai")
  );
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
