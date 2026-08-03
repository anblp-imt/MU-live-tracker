# News Source Filter & BBC Feed Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix BBC RSS to return written articles about MU (not audio), and add source filter chips on the news list page.

**Architecture:** Task 1 changes `lib/newsBbc.ts` to use the general football feed + MU mention filter (same pattern as ESPN). Task 2 adds client-side filter chips to `NewsClient.tsx` with `useState` for `selectedSource`. The two tasks are independent and can be developed in parallel, but Task 1 should commit first since it changes the data shape that Task 2's tests depend on.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest + Testing Library. No new dependencies.

---

### Task 1: Switch BBC feed to general football + MU mention filter

**Files:**
- Modify: `lib/newsBbc.ts`
- Modify: `lib/newsBbc.test.ts`

**Interfaces:**
- Consumes: `newsArticleId()` from `lib/newsId.ts`, `NewsArticle` from `lib/types.ts` (unchanged).
- Produces: `fetchBbcNews()` — same signature, different feed URL and filter pipeline.

The existing `isWrittenArticle()` filter stays (rejects `/sounds/`). Adding `isAboutMu()` filter (rejects articles without MU mention in title or description), mirroring `lib/newsEspn.ts` exactly.

- [ ] **Step 1: Write the failing test for MU mention filter**

In `lib/newsBbc.test.ts`, add this test after the existing "filters out BBC Sounds audio items" test:

```ts
it('filters out articles that do not mention Manchester United', async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
  <title><![CDATA[BBC Sport]]></title>
  <item>
  <title><![CDATA[Man United boss Skinner leaves role before WSL season]]></title>
  <description><![CDATA[Manchester United manager departs.]]></description>
  <link>https://www.bbc.co.uk/sport/football/articles/mu001</link>
  <pubDate>Fri, 31 Jul 2026 16:22:00 GMT</pubDate>
  </item>
  <item>
  <title><![CDATA[Liverpool ship four second-half goals]]></title>
  <description><![CDATA[Liverpool dominate in the Premier League.]]></description>
  <link>https://www.bbc.co.uk/sport/football/articles/liv001</link>
  <pubDate>Fri, 31 Jul 2026 15:00:00 GMT</pubDate>
  </item>
  <item>
  <title><![CDATA[Chelsea sign Strasbourg midfielder Barco]]></title>
  <description><![CDATA[Chelsea complete signing.]]></description>
  <link>https://www.bbc.co.uk/sport/football/articles/che001</link>
  <pubDate>Fri, 31 Jul 2026 14:00:00 GMT</pubDate>
  </item>
  </channel>
  </rss>`;

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => xml }));

  const result = await fetchBbcNews();

  expect(result).toHaveLength(1);
  expect(result[0].title).toBe('Man United boss Skinner leaves role before WSL season');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/newsBbc.test.ts`
Expected: FAIL — the new test expects 1 article but the current code (with old feed URL and no MU filter) would return 3 articles (all 3 pass `isWrittenArticle` since none have `/sounds/`).

- [ ] **Step 3: Update the feed URL and add MU mention filter**

In `lib/newsBbc.ts`, replace the feed URL constant:

```ts
const BBC_FEED_URL = 'https://feeds.bbci.co.uk/sport/football/teams/manchester-united/rss.xml';
```

with:

```ts
const BBC_FEED_URL = 'https://feeds.bbci.co.uk/sport/football/rss.xml';
```

Add the MU mention regex and filter function after `isWrittenArticle`:

```ts
const MU_MENTION_RE = /manchester united|man utd|man united/i;

function isAboutMu(item: BbcRssItem): boolean {
  return MU_MENTION_RE.test(item.title) || MU_MENTION_RE.test(item.description);
}
```

Update the filter pipeline in `fetchBbcNews` to chain `isAboutMu` after `isWrittenArticle`:

```ts
const items: BbcRssItem[] = (Array.isArray(raw) ? raw : raw ? [raw] : [])
  .filter(isWrittenArticle)
  .filter(isAboutMu);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/newsBbc.test.ts`
Expected: PASS (4 tests — 3 existing + 1 new).

- [ ] **Step 5: Run the full test suite**

Run: `npm test -- --run`
Expected: All tests pass (305+1 = 306).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/newsBbc.ts lib/newsBbc.test.ts
git commit -m "fix(news): switch BBC feed to general football + MU mention filter"
```

---

### Task 2: Add source filter chips to NewsClient

**Files:**
- Modify: `app/news/NewsClient.tsx`
- Modify: `app/news/page.module.css`
- Modify: `app/news/NewsClient.test.tsx`

**Interfaces:**
- Consumes: `NewsArticle` type (unchanged), existing `usePolling` hook.
- Produces: Filter bar UI with "All / BBC / Guardian / ESPN" chips.

Add `useState` for `selectedSource: string | null`. Filter articles client-side. Render filter chips above the article list.

- [ ] **Step 1: Write the failing test for filter chips**

In `app/news/NewsClient.test.tsx`, add this test after the existing "shows an empty state" test:

```ts
it('renders source filter chips and filters articles when a source is selected', async () => {
  mockNewsResponse([
    article({ id: 'bbc1', source: 'BBC', title: 'BBC article' }),
    article({ id: 'gd1', source: 'Guardian', title: 'Guardian article' }),
    article({ id: 'es1', source: 'ESPN', title: 'ESPN article' }),
  ]);

  render(<NewsClient />);

  await waitFor(() => expect(screen.getByText('BBC article')).toBeInTheDocument());

  // Filter chips should be visible
  const allChip = screen.getByRole('button', { name: /all/i });
  const bbcChip = screen.getByRole('button', { name: /bbc/i });
  expect(allChip).toBeInTheDocument();
  expect(bbcChip).toBeInTheDocument();

  // Click BBC chip — should only show BBC article
  bbcChip.click();

  await waitFor(() => {
    expect(screen.getByText('BBC article')).toBeInTheDocument();
    expect(screen.queryByText('Guardian article')).not.toBeInTheDocument();
    expect(screen.queryByText('ESPN article')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/news/NewsClient.test.tsx`
Expected: FAIL — filter chips don't exist yet; `getByRole('button', { name: /all/i })` will throw.

- [ ] **Step 3: Add filter state and chips to NewsClient**

In `app/news/NewsClient.tsx`, add `useState` import and state:

```tsx
import { useState } from 'react';
```

Inside the component, after the `usePolling` call, add:

```tsx
const [selectedSource, setSelectedSource] = useState<string | null>(null);
```

Replace the `articles` derivation with filtered articles:

```tsx
const allArticles = data?.articles ?? [];
const articles = selectedSource
  ? allArticles.filter(a => a.source === selectedSource)
  : allArticles;
```

Add the filter bar JSX between the subtitle and the loading/empty/list branches:

```tsx
<p className={styles.subtitle}>Latest Manchester United coverage from BBC Sport, The Guardian &amp; ESPN</p>

<div className={styles.filterBar}>
  <button
    className={!selectedSource ? styles.filterChipActive : styles.filterChip}
    onClick={() => setSelectedSource(null)}
    role="button"
  >
    All ({allArticles.length})
  </button>
  {(['BBC', 'Guardian', 'ESPN'] as const).map(source => {
    const count = allArticles.filter(a => a.source === source).length;
    return (
      <button
        key={source}
        className={selectedSource === source ? styles.filterChipActive : styles.filterChip}
        onClick={() => setSelectedSource(source)}
        role="button"
      >
        {source} ({count})
      </button>
    );
  })}
</div>
```

- [ ] **Step 4: Add CSS for filter chips**

In `app/news/page.module.css`, add after the `.subtitle` block:

```css
.filterBar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.filterChip {
  height: 24px;
  padding: 0 12px;
  border: 1px solid var(--mu-gold);
  border-radius: 12px;
  background: transparent;
  color: var(--mu-gold);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

.filterChip:hover {
  background: rgba(201, 162, 39, 0.1);
}

.filterChipActive {
  height: 24px;
  padding: 0 12px;
  border: 1px solid var(--mu-gold);
  border-radius: 12px;
  background: var(--mu-gold);
  color: var(--mu-black);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: default;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run app/news/NewsClient.test.tsx`
Expected: PASS (4 tests — 3 existing + 1 new).

- [ ] **Step 6: Run the full test suite**

Run: `npm test -- --run`
Expected: All tests pass (306+1 = 307).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/news/NewsClient.tsx app/news/page.module.css app/news/NewsClient.test.tsx
git commit -m "feat(news): add source filter chips to news list page"
```

---

### Task 3: Verify integration and lint

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm test -- --run`
Expected: 307 tests pass.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors/warnings beyond pre-existing ones (6 errors, 5 warnings in unrelated files).

- [ ] **Step 4: Commit if any fixes were needed**

(Only if Step 3 revealed issues that needed code changes.)