import type { ArticleRecord, ArticleRepository } from "./ingest";

type D1Like = {
  exec: (query: string) => Promise<unknown>;
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<unknown>;
    };
  };
};

export class D1ArticleRepository implements ArticleRepository {
  constructor(private readonly db: D1Like) {}

  async upsertMany(records: ArticleRecord[]): Promise<number> {
    if (records.length === 0) {
      return 0;
    }

    await this.ensureSchema();

    for (const record of records) {
      await this.db
        .prepare(
          `INSERT INTO articles (canonical_url, title, published_at, categories_json, first_seen_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(canonical_url) DO UPDATE SET
             title = excluded.title,
             published_at = excluded.published_at,
             categories_json = excluded.categories_json`
        )
        .bind(record.canonicalUrl, record.title, record.publishedAt, record.categoriesJson)
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
      first_seen_at TEXT NOT NULL
    )`);
  }
}
