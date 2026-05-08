import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
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
  return (
    <main className="shell">
      <h1>InsightsRadar</h1>
      <p>React + Router scaffold in place for ArticlesTileView.</p>
      <ul>
        <li>
          <Link to="/article/demo/summary">Article summary route</Link>
        </li>
        <li>
          <Link to="/article/demo/detail">Article detail route</Link>
        </li>
      </ul>
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
