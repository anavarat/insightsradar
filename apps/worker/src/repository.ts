import type { DigestArtifacts } from "./digest";
import { decodeCursor, encodeCursor } from "./feed";
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
    publishedAt: string;
    categoriesJson: string;
    keywordsJson: string;
  } | null> {
    await this.ensureSchema();
    const row = await this.db
      .prepare("SELECT canonical_url, title, published_at, categories_json, keywords_json FROM articles WHERE canonical_url = ?")
      .bind(canonicalUrl)
      .all<{ canonical_url: string; title: string; published_at: string; categories_json: string; keywords_json: string }>();
    const item = row.results[0];
    if (!item) {
      return null;
    }
    return {
      canonicalUrl: item.canonical_url,
      title: item.title,
      publishedAt: item.published_at,
      categoriesJson: item.categories_json,
      keywordsJson: item.keywords_json
    };
  }

  async markDigestSuccess(params: {
    canonicalUrl: string;
    modelPrimary: string;
    modelFallback: string;
    modelUsedFinal: string;
    retryCount: number;
    artifacts: DigestArtifacts;
    wordCountArticle: number;
    wordCountKeyworddigest: number;
    wordCountLevel1digest: number;
    wordCountLevel2digest: number;
    r2SourceKey: string;
    r2Level1Key: string;
    r2Level2Key: string;
  }): Promise<void> {
    await this.ensureSchema();
    await this.db
      .prepare(
        `UPDATE articles
         SET status = ?,
             failure_reason = NULL,
             model_primary = ?,
             model_fallback = ?,
             model_used_final = ?,
             retry_count = ?,
             keyworddigest = ?,
             level1digest_json = ?,
             level2digest_json = ?,
             word_count_article = ?,
             word_count_keyworddigest = ?,
             word_count_level1digest = ?,
             word_count_level2digest = ?,
             r2_source_key = ?,
             r2_level1_key = ?,
             r2_level2_key = ?
         WHERE canonical_url = ?`
      )
      .bind(
        "processed",
        params.modelPrimary,
        params.modelFallback,
        params.modelUsedFinal,
        params.retryCount,
        params.artifacts.keyworddigest,
        JSON.stringify(params.artifacts.level1digest),
        JSON.stringify(params.artifacts.level2digest),
        params.wordCountArticle,
        params.wordCountKeyworddigest,
        params.wordCountLevel1digest,
        params.wordCountLevel2digest,
        params.r2SourceKey,
        params.r2Level1Key,
        params.r2Level2Key,
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

  async listArticleTiles(params: { cursor: string | null; limit: number }): Promise<{
    items: Array<{ articleId: string; articleTitle: string; keyworddigest: string; publishedAt: string }>;
    nextCursor: string | null;
  }> {
    await this.ensureSchema();
    const cursor = decodeCursor(params.cursor);

    const result = cursor
      ? await this.db
          .prepare(
            `SELECT canonical_url, title, keyworddigest, published_at
             FROM articles
             WHERE status = 'processed'
               AND keyworddigest IS NOT NULL
               AND (published_at < ? OR (published_at = ? AND canonical_url < ?))
             ORDER BY published_at DESC, canonical_url DESC
             LIMIT ?`
          )
          .bind(cursor.publishedAt, cursor.publishedAt, cursor.canonicalUrl, params.limit + 1)
          .all<{ canonical_url: string; title: string; keyworddigest: string; published_at: string }>()
      : await this.db
          .prepare(
            `SELECT canonical_url, title, keyworddigest, published_at
             FROM articles
             WHERE status = 'processed'
               AND keyworddigest IS NOT NULL
             ORDER BY published_at DESC, canonical_url DESC
             LIMIT ?`
          )
          .bind(params.limit + 1)
          .all<{ canonical_url: string; title: string; keyworddigest: string; published_at: string }>();

    const hasMore = result.results.length > params.limit;
    const rows = hasMore ? result.results.slice(0, params.limit) : result.results;

    const items = rows.map((row) => ({
      articleId: row.canonical_url,
      articleTitle: row.title,
      keyworddigest: row.keyworddigest,
      publishedAt: row.published_at
    }));

    const next = rows[rows.length - 1];
    const nextCursor = hasMore && next ? encodeCursor({ publishedAt: next.published_at, canonicalUrl: next.canonical_url }) : null;

    return { items, nextCursor };
  }

  async getArticleSummary(articleId: string): Promise<{
    articleId: string;
    articleTitle: string;
    keyworddigest: string;
    level1digest: string[];
  } | null> {
    await this.ensureSchema();
    const row = await this.db
      .prepare(
        `SELECT canonical_url, title, keyworddigest, level1digest_json
         FROM articles
         WHERE canonical_url = ? AND status = 'processed'`
      )
      .bind(articleId)
      .all<{ canonical_url: string; title: string; keyworddigest: string; level1digest_json: string }>();
    const item = row.results[0];
    if (!item || !item.keyworddigest || !item.level1digest_json) {
      return null;
    }
    return {
      articleId: item.canonical_url,
      articleTitle: item.title,
      keyworddigest: item.keyworddigest,
      level1digest: parseStringArray(item.level1digest_json)
    };
  }

  async getArticleDetail(articleId: string): Promise<{
    articleId: string;
    articleTitle: string;
    keyworddigest: string;
    level2digest: {
      conceptsEntities: string[];
      summaryBullets: string[];
      conclusionBullets: string[];
    };
  } | null> {
    await this.ensureSchema();
    const row = await this.db
      .prepare(
        `SELECT canonical_url, title, keyworddigest, level2digest_json
         FROM articles
         WHERE canonical_url = ? AND status = 'processed'`
      )
      .bind(articleId)
      .all<{ canonical_url: string; title: string; keyworddigest: string; level2digest_json: string }>();
    const item = row.results[0];
    if (!item || !item.keyworddigest || !item.level2digest_json) {
      return null;
    }
    const parsed = parseLevel2(item.level2digest_json);
    return {
      articleId: item.canonical_url,
      articleTitle: item.title,
      keyworddigest: item.keyworddigest,
      level2digest: parsed
    };
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
      model_primary TEXT,
      model_fallback TEXT,
      model_used_final TEXT,
      keyworddigest TEXT,
      level1digest_json TEXT,
      level2digest_json TEXT,
      digest_attempts_json TEXT,
      word_count_article INTEGER,
      word_count_keyworddigest INTEGER,
      word_count_level1digest INTEGER,
      word_count_level2digest INTEGER,
      r2_source_key TEXT,
      r2_level1_key TEXT,
      r2_level2_key TEXT,
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
    await this.db.exec("ALTER TABLE articles ADD COLUMN model_primary TEXT").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN model_fallback TEXT").catch(() => {
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
    await this.db.exec("ALTER TABLE articles ADD COLUMN word_count_article INTEGER").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN word_count_keyworddigest INTEGER").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN word_count_level1digest INTEGER").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN word_count_level2digest INTEGER").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN r2_source_key TEXT").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN r2_level1_key TEXT").catch(() => {
      return;
    });
    await this.db.exec("ALTER TABLE articles ADD COLUMN r2_level2_key TEXT").catch(() => {
      return;
    });
  }
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function parseLevel2(raw: string): { conceptsEntities: string[]; summaryBullets: string[]; conclusionBullets: string[] } {
  try {
    const parsed = JSON.parse(raw) as {
      conceptsEntities?: unknown;
      summaryBullets?: unknown;
      conclusionBullets?: unknown;
    };
    return {
      conceptsEntities: Array.isArray(parsed.conceptsEntities)
        ? parsed.conceptsEntities.filter((x): x is string => typeof x === "string")
        : [],
      summaryBullets: Array.isArray(parsed.summaryBullets)
        ? parsed.summaryBullets.filter((x): x is string => typeof x === "string")
        : [],
      conclusionBullets: Array.isArray(parsed.conclusionBullets)
        ? parsed.conclusionBullets.filter((x): x is string => typeof x === "string")
        : []
    };
  } catch {
    return { conceptsEntities: [], summaryBullets: [], conclusionBullets: [] };
  }
}
