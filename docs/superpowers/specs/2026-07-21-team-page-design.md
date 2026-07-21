# Team page design

## Goal

Add a "Team" tab showing Manchester United's current first-team squad, grouped by
position (Goalkeepers / Defenders / Midfielders / Forwards) like manutd.com's men's
team page — but each player renders as a jersey graphic + name + squad number, with
no player photo.

## Data sources & merge strategy

Two APIs are already wired into this codebase (`lib/fd.ts`, `lib/espn.ts`), and neither
alone is good enough for this feature:

- **football-data.org** (`GET /teams/66`) returns the accurate, current squad list
  (name, position, nationality, DOB) — verified live to include signings ESPN's roster
  is missing (Andrey Santos, Youri Tielemans). It has **no shirt number field** on the
  free tier (verified: only `id`, `name`, `position`, `dateOfBirth`, `nationality`).
- **ESPN** (`GET /apis/site/v2/sports/soccer/eng.1/teams/360/roster`) returns jersey
  numbers and a position category, but its athlete list itself is stale — verified live
  to be missing Andrey Santos and Youri Tielemans entirely, and to still include players
  who've since left (André Onana) or are out on loan (Marcus Rashford). Retrying with a
  `season` param or an alternate team-detail endpoint returned the same stale list, so
  this isn't a caching artifact — ESPN's own data hasn't caught up.

**Design decision:** football-data's squad is the source of truth for *who's on the
squad* and their position group. ESPN's roster is used only to look up each player's
jersey number, matched by name with diacritics stripped (ESPN: "Bayindir", FD:
"Bayındır"). A football-data player with no ESPN match renders with a placeholder `–`
instead of a number, rather than being dropped from the page. This means a couple of
recent signings may show `–` until ESPN's own data updates — accepted as a known
limitation (self-heals once ESPN updates; no maintenance needed), and strictly better
than the alternative of the player not appearing on the page at all.

## Architecture

- `lib/fd.ts`: add `fetchSquad(apiKey): Promise<FdSquadPlayer[]>` calling
  `/teams/66`, returning the `squad` array (same `FdApiError` handling as existing
  functions).
- `lib/espn.ts`: add `fetchEspnRoster(slug, teamId): Promise<EspnTeamRoster>` calling
  `/apis/site/v2/sports/soccer/{slug}/teams/{teamId}/roster` (same `espnFetch` helper
  already used by `fetchEspnSchedule`/`fetchEspnDetail`).
- `lib/types.ts`: add `FdSquadPlayer` (`{ name, position, dateOfBirth, nationality }`)
  and `EspnTeamRoster`/`EspnTeamAthlete` (`{ jersey?, position: { displayName },
  displayName }`) wire types.
- `lib/team.ts` (new, pure functions, unit-tested — same pattern as `lib/formation.ts`):
  - `buildSquad(fdSquad, espnRoster): TeamGroup[]` — maps FD `position` ("Goalkeeper" /
    "Defence" / "Midfield" / "Offence") to the four display groups, looks up each
    player's jersey number from the ESPN roster by normalized-name match, and sorts each
    group by jersey number ascending with unnumbered players last (by name).
  - `TeamGroup = { label: 'Goalkeepers' | 'Defenders' | 'Midfielders' | 'Forwards';
    players: Array<{ name: string; jersey: number | null }> }`.
- `app/api/team/route.ts` (new): calls `fetchSquad` + `fetchEspnRoster` in parallel
  (`Promise.all`), passes both into `buildSquad`, caches the result with
  `STATIC_TTL_MS` (squad composition changes far less often than a live score — same
  tier already used for standings).
- `app/team/page.tsx` (new client page): `usePolling` (same pattern as Standings),
  `PageHeading` with title "Team", a subtitle line ("Current first-team squad, by
  position"), and one section per `TeamGroup`.
- `components/JerseyIcon.tsx` (new): renders the SVG jersey + squad number for one
  player (see Visual design below).
- `app/team/page.module.css` (new).
- `app/layout.tsx`: add `<Link href="/team">Team</Link>` to the nav, after "Stats".

## Visual design

Validated via an interactive mockup (iterated live with the user) at each step:
jersey shape, trim color, background, typography, and label color were all adjusted
based on direct feedback. Final reference SVG (viewBox `0 0 100 100`), to port into
`JerseyIcon.tsx`:

```html
<svg class="shirt" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- set-in sleeves + torso, 98/99 Umbro silhouette (no underarm gap) -->
  <path d="M29,19 L14,26 L9,40 L21,46 L29,46 L29,92 L71,92 L71,46 L79,46 L91,40 L86,26 L71,19 Z"
        fill="#DA291C" stroke="#EDE6D6" stroke-width="1.6" stroke-linejoin="round"/>
  <!-- diagonal shoulder piping (raglan seam line) -->
  <path d="M29,19 L21,46" stroke="#EDE6D6" stroke-width="1.1" opacity="0.9"/>
  <path d="M71,19 L79,46" stroke="#EDE6D6" stroke-width="1.1" opacity="0.9"/>
  <!-- V-neck collar: white with black piping -->
  <path d="M36,17 L45,22 L50,29 L55,22 L64,17 L64,21 L56,29 L50,36 L44,29 L36,21 Z"
        fill="#EDE6D6" stroke="#0d0d0d" stroke-width="1.3" stroke-linejoin="round"/>
  <!-- sleeve cuffs: white band with black piping -->
  <path d="M9,40 L21,46 L19.5,49.5 L7.5,43.5 Z" fill="#EDE6D6" stroke="#0d0d0d" stroke-width="1"/>
  <path d="M91,40 L79,46 L80.5,49.5 L92.5,43.5 Z" fill="#EDE6D6" stroke="#0d0d0d" stroke-width="1"/>
</svg>
```

The squad number renders as an absolutely-positioned `<span>` on top of the icon
(`top: 56%; left: 50%; transform: translate(-50%, -50%)`), not baked into the SVG, so
`JerseyIcon` can take `jersey: number | null` as a prop and render the same markup for
every player.

Key decisions from that process:

- **Jersey**: a flat-illustration SVG evoking the 1998–99 Umbro home kit (the
  Treble-winning shirt) — set-in sleeves (not raglan), a white V-neck collar with black
  piping, white cuffs with black piping, a diagonal white shoulder-seam piping line, and
  a plain red body (no crest — avoids reproducing the actual club crest/trademark). No
  player photo anywhere.
  - Body outline and seam seams use `--mu-white` (`#EDE6D6`), not a darker red — an
    earlier version used a dark-red outline that was nearly invisible against the red
    fill.
  - The body silhouette must be a single polygon with no concave notch at the underarm
    — an earlier version had a gap there that exposed the page's dark background,
    which read as an unwanted black wedge. There is **no background card/square** behind
    the jersey; the fix was the polygon itself, not a backdrop.
  - Squad number sits centered in the chest (`top: 56%` of the icon), in
    `--font-mono`, bold, `--mu-white`; missing numbers render `–` in a dimmer tone.
- **Grouping**: four sections in this fixed order — Goalkeepers, Defenders,
  Midfielders, Forwards — each with a player-count badge, sorted by jersey number
  ascending (unnumbered last). Section label is neutral (`--mu-white` at 60% opacity,
  mono, uppercase, letter-spaced), deliberately **not** gold — gold is reserved for
  player names so the two tiers of information (structural label vs. player content)
  stay visually distinct.
- **Player name**: two stacked lines under the jersey — given name (small, mono,
  uppercase, `--mu-gold`) above surname (larger, bold, `--font-heading`, uppercase,
  same `--mu-gold`). Both lines share one color per explicit user preference; the
  hierarchy comes from size/weight, not color.
- **Layout**: responsive grid (`repeat(auto-fill, minmax(96px, 1fr))`, tighter at
  `max-width: 460px`), matching the card-grid rhythm of manutd.com's team page without
  copying its dark-photo-card treatment.

## Testing

- `lib/team.test.ts`: unit tests for `buildSquad` — position-group mapping, jersey-sort
  order (numbered ascending, unnumbered last), diacritic-normalized name matching, and
  the graceful-`–`-fallback when no ESPN match exists.
- `app/api/team/route.test.ts`: route returns merged/grouped data, honors
  `STATIC_TTL_MS` caching (same style as `app/api/standings/route.ts` if it has a test;
  otherwise mirror `app/api/matches/route.test.ts`'s structure).
- `app/team/page.test.tsx`: renders four group headings, correct player count per
  group, and the jersey graphic for at least one numbered and one unnumbered player.

## Out of scope

- Player photos (explicitly excluded by the user).
- Reconciling ESPN's stale roster beyond name-matching (no further scraping/manual
  overrides — accepted as a known, self-healing limitation).
- Historical/former squads — this is the *current* squad only, no season picker.
