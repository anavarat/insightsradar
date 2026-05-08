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
