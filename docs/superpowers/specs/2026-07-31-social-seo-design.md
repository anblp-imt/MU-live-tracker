# Social & search SEO design

## Goal

Give the site professional-grade SEO for both social sharing and search engines:
correct per-page Open Graph/Twitter Card metadata so links shared to Facebook, Zalo, X,
LinkedIn, and TikTok show the right title/description/thumbnail, plus `sitemap.xml`,
`robots.txt`, and baseline JSON-LD structured data for Google/Bing.

## Scope decisions (from brainstorming)

- Both social preview *and* search-engine metadata (sitemap/robots/JSON-LD) — not
  social-only.
- Match detail (`/match/[id]`) OG image: the same shared static image used everywhere
  else, not a per-match generated image (`next/og` `ImageResponse`). Simpler, no image
  generation code.
- Sitemap: the 4 static routes only (`/`, `/standings`, `/stats`, `/team`) — individual
  `/match/[id]` pages are not enumerated. This does **not** limit their shareability:
  sitemap only affects search-engine discovery, not social unfurling, which reads a
  page's own `<head>` tags regardless of whether the URL is listed anywhere.
- JSON-LD: basic `WebSite` + `SportsTeam` only, site-wide. No per-match `SportsEvent`
  schema.
- No change to the client-side data-fetching architecture. Pages remain fully
  client-rendered after the initial shell; only `<head>` metadata moves server-side. A
  deeper gap was identified during design — client components render a loading spinner
  in the very first server-rendered HTML (before `useEffect` fires), so a crawler that
  doesn't wait on JS sees no real body content — but seeding real data server-side to
  fix that was explicitly deferred as separate, larger-scope work (see Out of scope).
- Domain stays `https://gloryglory.vercel.app`. `SITE_URL` is centralized in one
  constant so pointing it at a future custom domain is a one-line change; buying/wiring
  a custom domain itself is a hosting decision outside this repo, left to the user.

## Why the current architecture blocks this

Next.js only allows `metadata` / `generateMetadata` exports from Server Components. All
5 route pages (`app/page.tsx`, `app/standings/page.tsx`, `app/stats/page.tsx`,
`app/team/page.tsx`, `app/match/[id]/page.tsx`) start with `'use client'` for their
polling-based data fetching, so none can export metadata today — this is the confirmed
root cause of why only the root layout currently has (static, page-independent) OG
tags.

## Architecture

Split each `page.tsx` into a thin Server wrapper (owns metadata) + a Client component
(owns the existing logic, moved verbatim, no behavior changes). `/` is excluded: its
title/description are identical to the root layout's own default metadata, so it
already gets the right OG tags with zero changes — splitting it would be a change with
no behavioral effect.

| Route | New client file | Server `page.tsx` |
|---|---|---|
| `/` | *(unchanged — inherits the root layout's default metadata as-is)* | *(unchanged)* |
| `/standings` | `app/standings/StandingsClient.tsx` | `export const metadata = buildMetadata({...})` |
| `/stats` | `app/stats/StatsClient.tsx` | same pattern |
| `/team` | `app/team/TeamClient.tsx` | same pattern |
| `/match/[id]` | `app/match/[id]/MatchDetailClient.tsx` | `export async function generateMetadata({ params })` |

Each Server `page.tsx` becomes a few lines: the metadata export, plus
`export default function XPage() { return <XClient />; }` (match detail's page still
renders `<MatchDetailClient />` with no props — that component already reads the route
param itself via `useParams()`).

`lib/seo.ts` (new):
- `SITE_URL`, `SITE_NAME`, `DEFAULT_DESCRIPTION`, `DEFAULT_OG_IMAGE` constants (moved
  out of `app/layout.tsx`).
- `buildMetadata({ title, description, path }): Metadata` — returns a complete
  `Metadata` object (title, description, `openGraph` with images/siteName/locale/type,
  `twitter`, `alternates.canonical`). This is centralized because Next.js does **not**
  deep-merge nested metadata fields — a child route's `openGraph` object fully replaces
  the parent's rather than merging key-by-key, so every route must supply a complete OG
  block. Without this helper that full block would be duplicated five times.

`generateMetadata` for match detail calls the same server-side functions the API route
already uses — `getMatches()` (`lib/matches.ts`) to resolve the app's match id to an
ESPN id, then `fetchEspnDetail()` (`lib/espn.ts`) — directly, not through an HTTP round
trip to `/api/match/[id]`. It reads/writes the same cache key
(`` `match-detail:${id}` ``, from `lib/cache.ts`) the route handler uses, so by the time
`MatchDetailClient` fetches on mount, it hits a warm cache instead of causing a second
live request. Builds the title as `"{Home} vs {Away} — Glory Glory Man United"`; if the
match id isn't found, falls back to `buildMetadata({ title: 'Match Detail', ... })`
(mirroring the route handler's existing 404 case) instead of throwing.

`app/layout.tsx`:
- Replaces its inline metadata object with
  `buildMetadata({ title: SITE_NAME, description: DEFAULT_DESCRIPTION, path: '/' })`.
- Adds a JSON-LD `<script type="application/ld+json">` in `<head>` with a `@graph` of
  `WebSite` + `SportsTeam` (schema.org's dedicated `SportsTeam` type is a better fit
  than a generic `Organization` for a football club). This is static and site-wide, so
  it belongs here rather than being repeated per page.

`app/sitemap.ts` (new): returns the 4 static routes as a `MetadataRoute.Sitemap`.

`app/robots.ts` (new): `allow: '/'`, pointing `sitemap` at `` `${SITE_URL}/sitemap.xml` ``.

## Testing

- The existing `app/page.test.tsx`, `app/standings/page.test.tsx`,
  `app/stats/page.test.tsx`, `app/team/page.test.tsx`, and
  `app/match/[id]/page.test.tsx` move alongside their component, renamed to
  `HomeClient.test.tsx` / `StandingsClient.test.tsx` / etc., importing from the new
  client file. No test behavior changes, since the moved components are unchanged.
- New `lib/seo.test.ts`: unit tests for `buildMetadata()` — title/description
  passthrough, and a complete OG object shape (no partial/undefined fields, since a
  missing field here means Next.js silently drops it rather than inheriting the
  parent's).
- A small test covering match detail's `generateMetadata`: known match id produces the
  "{Home} vs {Away}" title; unknown id falls back without throwing.
- Lightweight tests for `app/sitemap.ts` / `app/robots.ts` asserting the expected URLs
  and rules shape.

## Out of scope (explicitly deferred)

- Per-match dynamic OG images (`opengraph-image.tsx` + `next/og`'s `ImageResponse`) —
  a static shared image was chosen instead.
- Sitemap entries for individual `/match/[id]` pages.
- `SportsEvent` JSON-LD per match.
- Server-side initial data seeding so crawlers see real body content (scores,
  standings) instead of a loading spinner on first paint — a real gap identified during
  design, but it touches all 4 pages' data-fetching logic, not just `<head>` metadata,
  so it's left for a separate, dedicated round of work.
- Custom domain / hosting changes — `SITE_URL` stays `https://gloryglory.vercel.app`.
