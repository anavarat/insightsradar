import { describe, expect, it } from "vitest";
import { filterEligibleArticles, parseCloudflareRss, runIngestion, type ArticleRecord } from "../src/ingest";

describe("ingestion eligibility", () => {
  const baseConfig = {
    ingestionMode: "product_engineering_only" as const,
    ingestionStartDate: "2026-05-01T00:00:00Z",
    primaryModel: "a",
    fallbackModel: "b"
  };

  it("excludes posts before start date", () => {
    const eligible = filterEligibleArticles(
      [
        {
          canonicalUrl: "https://blog.cloudflare.com/a",
          title: "A",
          publishedAt: "2026-04-30T23:00:00Z",
          categories: ["Product"]
        }
      ],
      baseConfig
    );

    expect(eligible).toHaveLength(0);
  });

  it("includes all categories in all mode", () => {
    const eligible = filterEligibleArticles(
      [
        {
          canonicalUrl: "https://blog.cloudflare.com/a",
          title: "A",
          publishedAt: "2026-05-03T10:00:00Z",
          categories: ["Life at Cloudflare"]
        }
      ],
      { ...baseConfig, ingestionMode: "all" }
    );

    expect(eligible).toHaveLength(1);
  });

  it("requires product or engineering categories in product_engineering_only mode", () => {
    const eligible = filterEligibleArticles(
      [
        {
          canonicalUrl: "https://blog.cloudflare.com/a",
          title: "A",
          publishedAt: "2026-05-03T10:00:00Z",
          categories: ["Life at Cloudflare"]
        },
        {
          canonicalUrl: "https://blog.cloudflare.com/b",
          title: "B",
          publishedAt: "2026-05-03T10:00:00Z",
          categories: ["Workers", "Product News"]
        }
      ],
      baseConfig
    );

    expect(eligible.map((x) => x.canonicalUrl)).toEqual(["https://blog.cloudflare.com/b"]);
  });
});

describe("runIngestion", () => {
  it("dedupes by canonical URL before persisting", async () => {
    const persisted: ArticleRecord[] = [];

    const count = await runIngestion({
      config: {
        ingestionMode: "all",
        ingestionStartDate: "2026-05-01T00:00:00Z",
        primaryModel: "a",
        fallbackModel: "b"
      },
      repository: {
        async upsertMany(records) {
          persisted.push(...records);
          return records.length;
        }
      },
      discover: async () => [
        {
          canonicalUrl: "https://blog.cloudflare.com/same",
          title: "One",
          publishedAt: "2026-05-03T10:00:00Z",
          categories: ["Workers"]
        },
        {
          canonicalUrl: "https://blog.cloudflare.com/same",
          title: "One Duplicate",
          publishedAt: "2026-05-03T10:00:00Z",
          categories: ["Workers"]
        }
      ]
    });

    expect(count.discovered).toBe(2);
    expect(count.eligible).toBe(1);
    expect(count.upserted).toBe(1);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.canonicalUrl).toBe("https://blog.cloudflare.com/same");
  });
});

describe("parseCloudflareRss", () => {
  it("parses canonical fields from RSS item", () => {
    const xml = `
      <rss>
        <channel>
          <item>
            <title>Workers update</title>
            <link>https://blog.cloudflare.com/workers-update/</link>
            <pubDate>Fri, 01 May 2026 12:00:00 GMT</pubDate>
            <category>Workers</category>
            <category>Product News</category>
          </item>
        </channel>
      </rss>
    `;

    const articles = parseCloudflareRss(xml);
    expect(articles).toHaveLength(1);
    expect(articles[0]?.canonicalUrl).toBe("https://blog.cloudflare.com/workers-update/");
    expect(articles[0]?.title).toBe("Workers update");
    expect(articles[0]?.categories).toEqual(["Workers", "Product News"]);
  });
});
