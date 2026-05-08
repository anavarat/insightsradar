import type { DigestArtifacts } from "./digest";
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
          `INSERT INTO articles (canonical_url, title, published_at, categories_json, keywords_json, content_hash, status, first_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(canonical_url) DO UPDATE SET
             title = excluded.title,
             published_at = excluded.published_at,
             categories_json = excluded.categories_json,
             keywords_json = excluded.keywords_json,
             content_hash = excluded.content_hash,
             status = excluded.status`
        )
        .bind(
          record.canonicalUrl,
          record.title,
          record.publishedAt,
          record.categoriesJson,
          record.keywordsJson,
          record.contentHash,
          "pending"
        )
        .run();
    }

    return records.length;
  }

  async getArticleForDigest(canonicalUrl: string): Promise<{
    canonicalUrl: string;
    title: string;
    keywordsJson: string;
  } | null> {
    await this.ensureSchema();
    const row = await this.db
      .prepare("SELECT canonical_url, title, keywords_json FROM articles WHERE canonical_url = ?")
      .bind(canonicalUrl)
      .all<{ canonical_url: string; title: string; keywords_json: string }>();
    const item = row.results[0];
    if (!item) {
      return null;
    }
    return {
      canonicalUrl: item.canonical_url,
      title: item.title,
      keywordsJson: item.keywords_json
    };
  }

  async markDigestSuccess(params: { canonicalUrl: string; modelUsedFinal: string; retryCount: number; artifacts: DigestArtifacts }): Promise<void> {
    await this.ensureSchema();
    await this.db
      .prepare(
        `UPDATE articles
         SET status = ?,
             failure_reason = NULL,
             model_used_final = ?,
             retry_count = ?,
             keyworddigest = ?,
             level1digest_json = ?,
             level2digest_json = ?
         WHERE canonical_url = ?`
      )
      .bind(
        "processed",
        params.modelUsedFinal,
        params.retryCount,
        params.artifacts.keyworddigest,
        JSON.stringify(params.artifacts.level1digest),
        JSON.stringify(params.artifacts.level2digest),
        params.canonicalUrl
      )
      .run();
  }

  async markDigestFailure(params: {
    canonicalUrl: string;
    failureReason: string;
    modelUsedFinal: string;
    retryCount: number;
    attemptsJson: string;
  }): Promise<void> {
    await this.ensureSchema();
    await this.db
      .prepare(
        `UPDATE articles
         SET status = ?,
             failure_reason = ?,
             model_used_final = ?,
             retry_count = ?,
             digest_attempts_json = ?
         WHERE canonical_url = ?`
      )
      .bind("digest_failed", params.failureReason, params.modelUsedFinal, params.retryCount, params.attemptsJson, params.canonicalUrl)
      .run();
  }

  private async ensureSchema(): Promise<void> {
    await this.db.exec(`CREATE TABLE IF NOT EXISTS articles (
      canonical_url TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      published_at TEXT NOT NULL,
      categories_json TEXT NOT NULL,
      keywords_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      status TEXT,
      failure_reason TEXT,
      retry_count INTEGER,
      model_used_final TEXT,
      keyworddigest TEXT,
      level1digest_json TEXT,
      level2digest_json TEXT,
      digest_attempts_json TEXT,
      first_seen_at TEXT NOT NULL
    )`);

    await this.db.exec("ALTER TABLE articles ADD COLUMN content_hash TEXT").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN keywords_json TEXT").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN status TEXT").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN failure_reason TEXT").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN retry_count INTEGER").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN model_used_final TEXT").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN keyworddigest TEXT").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN level1digest_json TEXT").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN level2digest_json TEXT").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN digest_attempts_json TEXT").catch(() => {
      return;
    });
  }
}
