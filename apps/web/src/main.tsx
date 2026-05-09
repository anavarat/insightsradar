import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Route, Routes, useParams } from "react-router-dom";
import type { ArticleDetail, ArticleSummary, ArticleTileFeed } from "@insightsradar/shared";
import "./styles.css";

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

function ArticleSummaryPage() {
  const { id } = useParams();
  const articleId = decodeURIComponent(id ?? "");
  const [data, setData] = React.useState<ArticleSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!articleId) {
      return;
    }
    const run = async () => {
      try {
        const qs = new URLSearchParams({ id: articleId });
        const response = await fetch(`/api/articles/summary?${qs.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to load summary (${response.status})`);
        }
        const payload = (await response.json()) as ArticleSummary;
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };
    void run();
  }, [articleId]);

  if (!articleId) {
    return <main className="shell">Invalid article id.</main>;
  }

  if (error) {
    return <main className="shell">{error}</main>;
  }

  if (!data) {
    return <main className="shell">Loading summary...</main>;
  }

  return (
    <main className="shell">
      <div className="nav-links">
        <Link to="/">Main</Link>
        <Link to={`/article/${encodeURIComponent(data.articleId)}/detail`}>Detailed View</Link>
      </div>
      <h1>{data.articleTitle}</h1>
      <p className="hero">{data.keyworddigest}</p>
      <ul>
        {data.level1digest.map((line, idx) => (
          <li key={`${idx}:${line}`}>{line}</li>
        ))}
      </ul>
    </main>
  );
}

function ArticleDetailPage() {
  const { id } = useParams();
  const articleId = decodeURIComponent(id ?? "");
  const [data, setData] = React.useState<ArticleDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!articleId) {
      return;
    }
    const run = async () => {
      try {
        const qs = new URLSearchParams({ id: articleId });
        const response = await fetch(`/api/articles/detail?${qs.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to load detail (${response.status})`);
        }
        const payload = (await response.json()) as ArticleDetail;
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };
    void run();
  }, [articleId]);

  if (!articleId) {
    return <main className="shell">Invalid article id.</main>;
  }

  if (error) {
    return <main className="shell">{error}</main>;
  }

  if (!data) {
    return <main className="shell">Loading detailed view...</main>;
  }

  return (
    <main className="shell">
      <div className="nav-links">
        <Link to="/">Main</Link>
        <Link to={`/article/${encodeURIComponent(data.articleId)}/summary`}>Summary View</Link>
      </div>
      <h1>{data.articleTitle}</h1>
      <p className="hero">{data.keyworddigest}</p>
      <section className="detail-scroll">
        <h2>Concepts / Entities</h2>
        <ul>
          {data.level2digest.conceptsEntities.map((line, idx) => (
            <li key={`c:${idx}:${line}`}>{line}</li>
          ))}
        </ul>
        <h2>Summary</h2>
        <ul>
          {data.level2digest.summaryBullets.map((line, idx) => (
            <li key={`s:${idx}:${line}`}>{line}</li>
          ))}
        </ul>
        <h2>Conclusion</h2>
        <ul>
          {data.level2digest.conclusionBullets.map((line, idx) => (
            <li key={`k:${idx}:${line}`}>{line}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/article/:id/summary" element={<ArticleSummaryPage />} />
        <Route path="/article/:id/detail" element={<ArticleDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
