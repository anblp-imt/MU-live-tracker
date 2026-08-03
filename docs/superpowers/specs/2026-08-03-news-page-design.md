# News Page — Design

**Goal:** Add a News tab that surfaces recent Manchester United coverage from reputable, dedicated sources — not a generic aggregator — while respecting copyright (no full-text reproduction, always credit and link to the original).

Mockup approved: list view + article detail view, in the app's existing red/gold/black identity — see chat history for the reviewed artifact (list cards with per-source badges; detail view with summary, image, and a "Read full article" link out).

## 1. Sources

Three dedicated MU feeds, each fetched server-side, no API key required:

| Source | Format | Endpoint |
|---|---|---|
| BBC Sport | RSS/XML | `https://feeds.bbci.co.uk/sport/football/teams/manchester-united/rss.xml` |
| The Guardian | RSS/XML | `https://www.theguardian.com/football/manchesterunited/rss` |
| ESPN | JSON | `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news?team=360` |

Considered and rejected during research:
- **Sky Sports** (`/rss/12040`) — despite the team-specific-looking ID, this is a general football-news feed; only ~1/20 items were actually about MU. Rejected as noise.
- **Manchester Evening News** — legitimate MU-tagged RSS feed, but a regional outlet, not top-tier alongside BBC/Guardian. Kept as a documented option, not integrated now — revisit only if the three sources above prove insufficient.
- **Google News search RSS** — aggregator with no control over underlying source quality; explicitly what the user wants to avoid. Rejected.

Each source's article count is limited by what the feed itself returns (BBC's team feed is sparse, ~4 items; Guardian ~20; ESPN's team-filtered news list varies) — no artificial cap is applied on top.

## 2. Data model

New type in `lib/types.ts`:

```ts
export interface NewsArticle {
  id: string;          // stable hash of `${source}:${sourceUrl}` — no shared ID exists across sources
  source: 'BBC' | 'Guardian' | 'ESPN';
  sourceUrl: string;    // link to the original article — always shown, always the "read more" target
  title: string;
  summary: string;      // short description/teaser from the feed — never full article text
  imageUrl?: string;
  publishedAt: string;  // ISO 8601
}
```

`id` generation: a simple deterministic hash (e.g. a small string-hash function, no crypto dependency needed) over `source + sourceUrl`, so the same article gets the same `id` across requests — needed for the `/news/[id]` detail route to resolve correctly against a freshly-fetched (not persisted) list.

## 3. Fetching & merge — `lib/news.ts`

New per-source modules, following the existing `lib/fd.ts` / `lib/espn.ts` pattern (one file per external source, a single exported fetch function that returns already-mapped domain types):

- `lib/newsBbc.ts` — fetches the RSS, parses with `fast-xml-parser` (new dependency — see below), maps `<item>` → `NewsArticle[]`.
- `lib/newsGuardian.ts` — same shape, Guardian's RSS.
- `lib/newsEspn.ts` — fetches the JSON endpoint, maps `articles[]` → `NewsArticle[]`.

**New dependency: `fast-xml-parser`.** The codebase currently has no XML parser (ESPN and football-data are both JSON). Hand-rolling RSS parsing via regex is fragile against CDATA sections, HTML entities inside descriptions, and namespaced tags (`media:thumbnail`, `dc:creator`) that both BBC's and Guardian's feeds use. `fast-xml-parser` is small, has zero dependencies of its own, and is the only new dependency this feature needs.

`lib/news.ts` orchestrates, mirroring `lib/matches.ts`'s `Promise.allSettled` pattern:

```ts
export async function getNews(): Promise<NewsArticle[]> {
  const cached = getCached<NewsArticle[]>(CACHE_KEY);
  if (cached) return cached;

  const results = await Promise.allSettled([
    fetchBbcNews(),
    fetchGuardianNews(),
    fetchEspnNews(),
  ]);
  const articles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  setCached(CACHE_KEY, articles, NEWS_TTL_MS);
  return articles;
}
```

- One source failing/timing out degrades the list (fewer articles) rather than failing the whole page — same resilience contract as matches.
- If all three fail, `articles` is `[]`; the UI shows a quiet empty/error state (see §5).
- No cross-source deduplication by content — different outlets covering the same story is normal for a news list and isn't treated as a duplicate (decided during brainstorming).

## 4. Caching

New constant in `lib/cache.ts`: `NEWS_TTL_MS = 20 * 60 * 1000` (20 minutes — news doesn't need live-match freshness; sits between `STATIC_TTL_MS` (5 min) and `LEADERS_TTL_MS` (6 h)). Uses the existing module-level `getCached`/`setCached`, same as every other data source.

## 5. Routes & UI

- `app/news/page.tsx` — server component, `buildMetadata({ title: 'News — Glory Glory Man United', ... })`, renders `NewsClient`.
- `app/news/NewsClient.tsx` — client component. `usePolling(fetchNews, null, { key: 'news', ttlMs: NEWS_TTL_MS })` (no auto-interval — news is refreshed on visit/manual refresh, not polled live, matching the Team page's pattern). Renders `PageHeading` + a list of cards (image thumbnail, source badge, title, 2-line summary, relative time), each linking to `/news/[id]`.
- `app/news/[id]/page.tsx` + `NewsDetailClient.tsx` — detail view. Fetches `/api/news` (served from the same server-side cache, so this is cheap), finds the article by `id` in the returned list, and renders: image, source badge + publish time, title, full summary, an explicit "Read full article on {source} ↗" button linking to `sourceUrl` (opens in new tab), and a small attribution line. If the `id` isn't found (cache expired between visits, or a stale/shared link), render a "not found" state with a link back to `/news` — no redirect, no throw.
- `app/api/news/route.ts` — `GET` → `getNews()` → `NextResponse.json({ articles })`.
- Nav (`app/layout.tsx`): add `<NavLink href="/news">News</NavLink>` after Team. **Match stays the home page** — this app's core identity is the live tracker; News is a supplementary tab, not a replacement for the homepage (confirmed with user during brainstorming).

## 6. Error handling

- Per-source fetch failures are absorbed by `Promise.allSettled` in `lib/news.ts` (§3) — never surfaces as a page-level error for a single dead source.
- Total failure (all 3 sources down) → empty array → `NewsClient` shows the same empty/error treatment `usePolling`'s `error` already drives elsewhere in the app (e.g. Team's error state), reusing existing UI conventions rather than inventing a new one.
- Detail page "article not found" is a soft state (message + back link), not a Next.js `notFound()` 404 — the article's existence is time-relative (cache-backed, not persisted), so treating a miss as a hard 404 would be misleading.

## 7. Testing

Following the project's convention (a `.test.ts`/`.test.tsx` beside every source file):

- `lib/newsBbc.test.ts`, `lib/newsGuardian.test.ts` — mock real RSS/XML sample (captured during research), assert correct `NewsArticle[]` mapping including CDATA/entity handling.
- `lib/newsEspn.test.ts` — mock real JSON sample, assert mapping.
- `lib/news.test.ts` — merge/sort behavior; one or two sources rejected → list still built from the survivors; all rejected → `[]`.
- `app/api/news/route.test.ts` — route returns cached/fetched articles.
- `app/news/page.test.tsx`, `app/news/NewsClient.test.tsx` — render, loading, error states.
- `app/news/[id]/page.test.tsx` / detail client test — found and not-found paths.

## 8. Copyright posture

No full article text is ever fetched, stored, or rendered — only what the feeds themselves expose (title, short summary/description, image, publish time, link). Every card and the detail page always show the source name and link back to the original; the detail page's primary call-to-action is leaving the app to read the full piece on the source's own site. This was an explicit user requirement, not an afterthought: crediting these sources is the point, not a compliance checkbox.
