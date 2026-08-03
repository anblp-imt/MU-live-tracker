# News Source Filter & BBC Feed Fix — Design

**Goal:** Fix BBC RSS to surface written articles about Manchester United (not audio), and add source filter chips on the news list page so users can narrow by BBC / Guardian / ESPN.

## 1. BBC Feed Change

**Problem:** The current BBC feed (`/teams/manchester-united/rss.xml`) only returns audio/podcast items (`/sounds/play/...`). The existing `/sounds/` filter correctly rejects them, but the result is 0 articles from BBC.

**Fix:** Switch to the general football feed (`/sport/football/rss.xml`) which returns written articles, and add a MU-mention content filter (same pattern as ESPN already uses).

**Pipeline:**
```
raw items → isWrittenArticle (reject /sounds/) → isAboutMu (reject no MU mention) → map to NewsArticle[]
```

**`isAboutMu` regex:** `/manchester united|man utd|man united/i` — matches title or description. Same approach as `lib/newsEspn.ts` (`MU_MENTION_RE`).

**File changed:** `lib/newsBbc.ts`

## 2. Source Filter Chips

**Problem:** No way to filter news by source. All 3 sources mix together.

**Approach:** Horizontal filter chips ("All / BBC / Guardian / ESPN") rendered above the article list. Clicking a chip sets `selectedSource` state; clicking "All" resets to null.

**State:** `selectedSource: string | null` (null = show all)

**Filtering:** Client-side `.filter(a => !selectedSource || a.source === selectedSource)` on the articles array before rendering.

**UI:**
- Filter bar: flex row, gap 8px, margin-bottom 16px
- Each chip: pill shape, 24px height, font-mono 11px, uppercase
- Active chip: gold background, dark text
- Inactive chip: transparent background, gold border, gold text
- Reuse existing `--mu-gold` / `--mu-surface` CSS variables
- "All" chip shows article count (e.g. "All (12)")

**Files changed:**
- `app/news/NewsClient.tsx` — add state + filter bar JSX
- `app/news/page.module.css` — add `.filterBar`, `.filterChip`, `.filterChipActive`

## 3. Testing

- `lib/newsBbc.test.ts` — update existing tests for new feed URL + add test for `isAboutMu` filter
- `app/news/NewsClient.test.tsx` — add test for filter chips rendering and filtering behavior

## 4. Error Handling

- BBC feed change doesn't change error semantics — `fetchBbcNews` still throws on failure, absorbed by `Promise.allSettled` in `lib/news.ts`.
- Filter is client-side only — no new network calls, no new failure modes.