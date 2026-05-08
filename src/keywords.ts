export type KeywordSignal = {
  label: string;
  source: "explicit" | "inferred" | "category";
  score: number;
};

export type RankedKeyword = {
  label: string;
  score: number;
  sources: Array<KeywordSignal["source"]>;
  normalized: boolean;
};

export type KeywordExtractionInput = {
  articleTitle: string;
  articleBody: string;
  categories: string[];
  inferredAreas: string[];
  topN?: number;
  maxN?: number;
};

const DEFAULT_TOP_N = 5;
const DEFAULT_MAX_N = 8;

const CANONICAL_KEYWORDS = [
  "Workers",
  "Workers AI",
  "R2",
  "D1",
  "KV",
  "Durable Objects",
  "Queues",
  "Zero Trust",
  "Cloudflare One",
  "WAF",
  "CDN",
  "Pages",
  "Turnstile",
  "Magic WAN",
  "Magic Transit",
  "API Shield"
] as const;

const CANONICAL_ALIASES: Record<string, string> = {
  "workersai": "Workers AI",
  "worker ai": "Workers AI",
  "workers ai": "Workers AI",
  "cf workers": "Workers",
  "cloudflare workers": "Workers",
  "cloudflare r2": "R2",
  "cloudflare d1": "D1",
  "durable object": "Durable Objects",
  "cloudflare pages": "Pages",
  "cloudflare one": "Cloudflare One"
};

const TOKEN_PATTERN = /[^a-z0-9 ]+/gi;

export function extractRankedKeywords(input: KeywordExtractionInput): RankedKeyword[] {
  const maxN = clampMaxN(input.maxN ?? DEFAULT_MAX_N);
  const targetN = Math.min(input.topN ?? DEFAULT_TOP_N, maxN);

  const signals: KeywordSignal[] = [];
  signals.push(...collectExplicitSignals(input.articleTitle, input.articleBody));
  signals.push(...collectCategorySignals(input.categories));
  signals.push(...collectInferredSignals(input.inferredAreas));

  const aggregate = new Map<string, RankedKeyword>();
  for (const signal of signals) {
    const normalized = normalizeKeyword(signal.label);
    const key = normalized.label.toLowerCase();
    const current = aggregate.get(key);

    if (!current) {
      aggregate.set(key, {
        label: normalized.label,
        score: signal.score,
        sources: [signal.source],
        normalized: normalized.changed
      });
      continue;
    }

    current.score += signal.score;
    if (!current.sources.includes(signal.source)) {
      current.sources.push(signal.source);
    }
    current.normalized = current.normalized || normalized.changed;
  }

  return [...aggregate.values()]
    .sort((a, b) => (b.score === a.score ? a.label.localeCompare(b.label) : b.score - a.score))
    .slice(0, targetN)
    .map((item) => ({
      ...item,
      score: Number(item.score.toFixed(4))
    }));
}

function collectExplicitSignals(title: string, body: string): KeywordSignal[] {
  const text = `${title}\n${body}`.toLowerCase();
  const signals: KeywordSignal[] = [];
  for (const canonical of CANONICAL_KEYWORDS) {
    const variants = aliasCandidates(canonical);
    let hits = 0;
    for (const variant of variants) {
      hits += countOccurrences(text, variant.toLowerCase());
    }

    if (hits > 0) {
      signals.push({
        label: canonical,
        source: "explicit",
        score: hits * 2
      });
    }
  }
  return signals;
}

function collectCategorySignals(categories: string[]): KeywordSignal[] {
  return categories
    .map((c) => c.trim())
    .filter(Boolean)
    .map((category) => ({
      label: category,
      source: "category" as const,
      score: 1.5
    }));
}

function collectInferredSignals(inferredAreas: string[]): KeywordSignal[] {
  return inferredAreas
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({
      label: item,
      source: "inferred" as const,
      score: 1
    }));
}

function normalizeKeyword(label: string): { label: string; changed: boolean } {
  const normalized = simplify(label);
  if (CANONICAL_ALIASES[normalized]) {
    return { label: CANONICAL_ALIASES[normalized], changed: true };
  }

  for (const canonical of CANONICAL_KEYWORDS) {
    if (simplify(canonical) === normalized) {
      return { label: canonical, changed: canonical !== label };
    }
  }

  return { label: titleCaseFreeform(label), changed: titleCaseFreeform(label) !== label };
}

function aliasCandidates(canonical: string): string[] {
  const aliases = Object.entries(CANONICAL_ALIASES)
    .filter(([, value]) => value === canonical)
    .map(([key]) => key);
  return [canonical.toLowerCase(), ...aliases];
}

function simplify(input: string): string {
  return input.toLowerCase().replace(TOKEN_PATTERN, " ").replace(/\s+/g, " ").trim();
}

function titleCaseFreeform(value: string): string {
  return simplify(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function countOccurrences(input: string, needle: string): number {
  if (!needle) {
    return 0;
  }
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "g");
  const matches = input.match(regex);
  return matches ? matches.length : 0;
}

function clampMaxN(value: number): number {
  if (value < 1) {
    return 1;
  }
  if (value > DEFAULT_MAX_N) {
    return DEFAULT_MAX_N;
  }
  return value;
}
