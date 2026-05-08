import type { ArticleRecord, ArticleRepository } from "./ingest";

type D1Like = {
  exec: (query: string) => Promise<unknown>;
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<unknown>;
      all: <T>() => Promise<{ results: T[] }>;
    };
  };
};

export class D1ArticleRepository implements ArticleRepository {
  constructor(private readonly db: D1Like) {}

  async getContentHashes(canonicalUrls: string[]): Promise<Map<string, string>> {
    await this.ensureSchema();
    if (canonicalUrls.length === 0) {
      return new Map();
    }

    const map = new Map<string, string>();
    for (const url of canonicalUrls) {
      const row = await this.db
        .prepare("SELECT canonical_url, content_hash FROM articles WHERE canonical_url = ?")
        .bind(url)
        .all<{ canonical_url: string; content_hash: string }>();
      const item = row.results[0];
      if (item?.content_hash) {
        map.set(item.canonical_url, item.content_hash);
      }
    }
    return map;
  }

  async upsertMany(records: ArticleRecord[]): Promise<number> {
    if (records.length === 0) {
      return 0;
    }

    await this.ensureSchema();

    for (const record of records) {
      await this.db
        .prepare(
          `INSERT INTO articles (canonical_url, title, published_at, categories_json, content_hash, first_seen_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(canonical_url) DO UPDATE SET
             title = excluded.title,
             published_at = excluded.published_at,
             categories_json = excluded.categories_json,
             content_hash = excluded.content_hash`
        )
        .bind(record.canonicalUrl, record.title, record.publishedAt, record.categoriesJson, record.contentHash)
        .run();
    }

    return records.length;
  }

  private async ensureSchema(): Promise<void> {
    await this.db.exec(`CREATE TABLE IF NOT EXISTS articles (
      canonical_url TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      published_at TEXT NOT NULL,
      categories_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      first_seen_at TEXT NOT NULL
    )`);

    await this.db.exec("ALTER TABLE articles ADD COLUMN content_hash TEXT").catch(() => {
      return;
    });
  }
}
