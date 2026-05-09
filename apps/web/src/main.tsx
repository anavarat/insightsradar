import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import type { ArticleTileFeed } from "@insightsradar/shared";
import "./styles.css";

function PlaceholderPage(props: { title: string }) {
  return (
    <main className="shell">
      <h1>{props.title}</h1>
      <p>Monorepo web scaffold is ready. Slice UI implementation follows in #7/#8.</p>
      <Link to="/">Back to main</Link>
    </main>
  );
}

function HomePage() {
  const [items, setItems] = React.useState<ArticleTileFeed["items"]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const loadMore = React.useCallback(async () => {
    if (loading || !hasMore) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "20");
      if (cursor) {
        qs.set("cursor", cursor);
      }
      const response = await fetch(`/api/articles?${qs.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch articles (${response.status})`);
      }
      const payload = (await response.json()) as ArticleTileFeed;
      setItems((previous) => [...previous, ...payload.items]);
      setCursor(payload.nextCursor);
      setHasMore(payload.nextCursor !== null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [cursor, hasMore, loading]);

  React.useEffect(() => {
    void loadMore();
  }, []);

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <main className="shell">
      <h1>Cloudflare Blog Digests</h1>
      {items.length === 0 && !loading && !error ? <p>No processed articles yet.</p> : null}
      <section className="tile-grid">
        {items.map((item) => (
          <Link key={`${item.articleId}:${item.publishedAt}`} to={`/article/${encodeURIComponent(item.articleId)}/summary`} className="tile">
            <h2>{item.articleTitle}</h2>
            <p>{item.keyworddigest}</p>
            <time>{new Date(item.publishedAt).toLocaleString()}</time>
          </Link>
        ))}
      </section>
      {error ? (
        <div className="status">
          <p>{error}</p>
          <button type="button" onClick={() => void loadMore()}>
            Retry
          </button>
        </div>
      ) : null}
      {loading ? <p className="status">Loading...</p> : null}
      {!hasMore && items.length > 0 ? <p className="status">You have reached the end.</p> : null}
      <div ref={sentinelRef} className="sentinel" aria-hidden="true" />
    </main>
  );
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/article/:id/summary" element={<PlaceholderPage title="ArticleSummaryView" />} />
        <Route path="/article/:id/detail" element={<PlaceholderPage title="ArticleDetailView" />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
