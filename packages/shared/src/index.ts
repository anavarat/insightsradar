export type ArticleTile = {
  articleId: string;
  articleTitle: string;
  keyworddigest: string;
  publishedAt: string;
};

export type ArticleTileFeed = {
  items: ArticleTile[];
  nextCursor: string | null;
};

export type ArticleSummary = {
  articleId: string;
  articleTitle: string;
  keyworddigest: string;
  level1digest: string[];
};

export type ArticleDetail = {
  articleId: string;
  articleTitle: string;
  keyworddigest: string;
  level2digest: {
    conceptsEntities: string[];
    summaryBullets: string[];
    conclusionBullets: string[];
  };
};
