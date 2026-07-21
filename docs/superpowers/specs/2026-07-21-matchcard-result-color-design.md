# MatchCard Result Color — Design

**Goal:** On the Schedule page (`/`), let a user see at a glance whether MU won, drew, or lost a finished fixture, without clicking into match detail.

## Approach

Add a pure helper in `components/MatchCard.tsx`:

```ts
function matchResult(match: Match): 'win' | 'draw' | 'loss' | null {
  if (match.status !== 'FINISHED') return null;
  const { home, away } = match.score.display;
  if (home == null || away == null) return null;
  const muScore = match.venue === 'H' ? home : away;
  const oppScore = match.venue === 'H' ? away : home;
  if (muScore > oppScore) return 'win';
  if (muScore < oppScore) return 'loss';
  return 'draw';
}
```

Apply the result as an extra class on the existing `.score` span (alongside the unconditional `styles.score`): `styles.win` / `styles.draw` / `styles.loss`, or nothing when `matchResult` returns `null`.

## CSS

In `MatchCard.module.css`, add (naming matches the existing `won`/`drawn`/`lost` convention on the Stats page and `dotW`/`dotD`/`dotL` on Standings):

```css
.win { color: var(--mu-green); }
.draw { color: var(--mu-gold); }
.loss { color: var(--mu-red); }
```

`.draw` is a no-op visually (the score is already gold by default via `.score`) but is kept explicit for consistency with the other two states and to make the mapping self-documenting.

## Scope

- Only `components/MatchCard.tsx` / `MatchCard.module.css` change. No new components, no props added — `matchResult` derives entirely from the `Match` already passed in.
- Only `FINISHED` matches get a result color. `SCHEDULED`/`TIMED`/`IN_PLAY`/`PAUSED`/`POSTPONED` are unaffected — live matches already have their own live-badge/flash treatment for "what's happening now"; this feature is specifically about a finished result being scannable without a click.

## Known limitation (accepted)

`Match.score.display` strips penalty-shootout goals by design (`lib/merge.ts:14-25`, `computeDisplayScore`) — a cup tie MU wins on penalties already displays as a normal-time draw score today (e.g. "1 : 1 FT"). This change inherits that same display value, so a shootout win will be colored gold (draw), not green (win). Fixing this would require fetching full match detail (shootout data lives only in `EspnDetail`, not the list-level `Match` type) for every card in the schedule list, which is out of scope here.

## Testing

Add to `components/MatchCard.test.tsx`:
- MU wins as home (`venue: 'H'`, home score > away score) → score span has the win class.
- MU draws → score span has the draw class.
- MU loses as away (`venue: 'A'`, away score < home score) → score span has the loss class.
- A `SCHEDULED`/`IN_PLAY` match → score span has none of the three result classes (no false positive before full time).
