import type { DigestArtifacts } from "./digest";

export type R2Like = {
  put: (key: string, value: string, options?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
};

export type StoredArtifactKeys = {
  sourceKey: string;
  level1Key: string;
  level2Key: string;
  processingKey: string;
};

export type WordCounts = {
  article: number;
  keyworddigest: number;
  level1digest: number;
  level2digest: number;
};

export function buildArtifactKeys(canonicalUrl: string): StoredArtifactKeys {
  const id = toArtifactId(canonicalUrl);
  return {
    sourceKey: `articles/${id}/source.json`,
    level1Key: `articles/${id}/level1digest.json`,
    level2Key: `articles/${id}/level2digest.json`,
    processingKey: `articles/${id}/processing.json`
  };
}

export async function persistArtifacts(params: {
  bucket: R2Like;
  canonicalUrl: string;
  articleTitle: string;
  articleBody: string;
  rankedKeywords: string[];
  artifacts: DigestArtifacts;
  modelPrimary: string;
  modelFallback: string;
  modelUsedFinal: string;
  attempts: Array<{ model: string; attempt: number; ok: boolean; error?: string }>;
}): Promise<{ keys: StoredArtifactKeys; wordCounts: WordCounts }> {
  const keys = buildArtifactKeys(params.canonicalUrl);
  const wordCounts = computeWordCounts({
    articleBody: params.articleBody,
    keyworddigest: params.artifacts.keyworddigest,
    level1digest: params.artifacts.level1digest,
    level2digest: params.artifacts.level2digest
  });

  await params.bucket.put(
    keys.sourceKey,
    JSON.stringify(
      {
        canonicalUrl: params.canonicalUrl,
        title: params.articleTitle,
        articleBody: params.articleBody,
        rankedKeywords: params.rankedKeywords,
        wordCountArticle: wordCounts.article
      },
      null,
      2
    ),
    { httpMetadata: { contentType: "application/json" } }
  );

  await params.bucket.put(
    keys.level1Key,
    JSON.stringify(
      {
        canonicalUrl: params.canonicalUrl,
        keyworddigest: params.artifacts.keyworddigest,
        level1digest: params.artifacts.level1digest,
        wordCountKeyworddigest: wordCounts.keyworddigest,
        wordCountLevel1digest: wordCounts.level1digest
      },
      null,
      2
    ),
    { httpMetadata: { contentType: "application/json" } }
  );

  await params.bucket.put(
    keys.level2Key,
    JSON.stringify(
      {
        canonicalUrl: params.canonicalUrl,
        keyworddigest: params.artifacts.keyworddigest,
        level2digest: params.artifacts.level2digest,
        wordCountLevel2digest: wordCounts.level2digest
      },
      null,
      2
    ),
    { httpMetadata: { contentType: "application/json" } }
  );

  await params.bucket.put(
    keys.processingKey,
    JSON.stringify(
      {
        canonicalUrl: params.canonicalUrl,
        modelPrimary: params.modelPrimary,
        modelFallback: params.modelFallback,
        modelUsedFinal: params.modelUsedFinal,
        attempts: params.attempts,
        generatedAt: new Date().toISOString()
      },
      null,
      2
    ),
    { httpMetadata: { contentType: "application/json" } }
  );

  return { keys, wordCounts };
}

export function computeWordCounts(params: {
  articleBody: string;
  keyworddigest: string;
  level1digest: string[];
  level2digest: { conceptsEntities: string[]; summaryBullets: string[]; conclusionBullets: string[] };
}): WordCounts {
  const level2Text = [
    ...params.level2digest.conceptsEntities,
    ...params.level2digest.summaryBullets,
    ...params.level2digest.conclusionBullets
  ].join("\n");

  return {
    article: countWords(params.articleBody),
    keyworddigest: countWords(params.keyworddigest),
    level1digest: countWords(params.level1digest.join("\n")),
    level2digest: countWords(level2Text)
  };
}

export function countWords(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

function toArtifactId(canonicalUrl: string): string {
  return canonicalUrl
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
