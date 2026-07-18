# LEARNING.md — React concepts this codebase teaches

A running notebook of the React mechanisms this project was built to make concrete.
Each entry points at the file/task where you can see it in real, working code — search
that file for `// [React]` comments for the inline explanation.

## 1. Props, lists, keys, conditional rendering (Milestone A)

- `components/MatchCard.tsx` (Task 15): a component that only reads props and returns
  different JSX based on `match.status` — no state at all. If you can't tell what a
  component renders without also knowing what happened to it before, it's not "just
  props" anymore.
- `components/MatchList.tsx` (Task 16): `.map()` over an array needs a `key` per item so
  React can match old DOM nodes to new ones across re-renders — using `match.id` (stable)
  instead of the array index (which shifts as the list is re-sorted/re-filtered) avoids
  React reusing the wrong DOM node for the wrong match.
- `app/page.tsx` (Task 17): the very first `useEffect` in this codebase, with the
  `cancelled` flag pattern — see section 3 below, it's introduced here in its simplest
  form before `usePolling` generalizes it.

## 2. State and lifting state up (Milestone B)

- `components/CompetitionFilterPills.tsx` (Task 18): a "controlled" component — it owns
  zero `useState`. Every bit of its behavior comes from `selected`/`onSelect` props.
- `app/schedule/page.tsx` (Task 18, before Task 22): the filter state lives on the page
  because the page is the nearest common parent of the two components that need it (the
  pills and the list). This is "lifting state up": move state to the lowest common
  ancestor of everyone who needs it, no higher.

## 3. `useEffect`, cleanup, refs (Milestone C — `usePolling`)

`hooks/usePolling.ts` (Task 19) is the deepest lesson in this codebase:

- **The effect body runs after render**, not during it — `setInterval` inside `useEffect`
  is how you synchronize a component with something outside React (a timer, in this
  case).
- **The cleanup function** (the function an effect returns) runs before the *next* effect
  and on unmount. Here it does two things: `clearInterval(id)` stops the timer, and
  setting `cancelled = true` stops a fetch that was already in flight from calling
  `setState` after this run is no longer current.
- **The ref (`fetcherRef`)** exists because the dependency array `[intervalMs]`
  deliberately does *not* include `fetcher` — an inline arrow function has a new identity
  every render, so putting it in the dependency array would tear down and rebuild the
  interval on every render, not just when `intervalMs` changes. The ref lets the effect
  always call the *latest* fetcher without needing to restart because of it.
- **Effect chaining**: `app/page.tsx` (Task 21) computes `intervalMs` from `data` — which
  is itself set *by* `usePolling` — in a second `useEffect`. A state update triggering
  another effect that triggers another state update is normal React, and easy to miss the
  first time you see it.

## 4. Context (Milestone D) — and why it was later removed

`contexts/CompetitionFilterContext.tsx` (Task 22): the trigger for reaching past "lift
state up" wasn't "this state feels important" — it was that the two components that
needed it (`NavFilterPills` in `app/layout.tsx`, and `app/schedule/page.tsx`) aren't in a
parent/child relationship. A Next.js layout renders a page through `{children}`; it has no
way to hand that page extra props. Context is what fills that specific gap. Compare this
to Task 18's local lifted state, which was enough until the same filter needed to live in
the shared layout too.

**Later removed** (2026-07-18 UI redesign): the nav pills were pulled off Today (a page
that shows at most one match — MU can't play twice in a day, so filtering by competition
there was meaningless) and off Standings (which already had its own local per-page tabs,
Task 26). Once Schedule was the *only* remaining consumer of the shared selection, the
Context had nothing left to share — two components in a parent/child relationship again,
so Task 18's plain local `useState` was the right tool once more. The lesson this leaves:
Context is a fix for a specific structural problem (state needed by non-parent/child
components), not a permanent upgrade over lifted state — when the structural reason goes
away, so should the Context.

## 5. Derived state and `useMemo` (Milestone E)

- `components/FormationPitch.tsx` (Task 24): `buildFormationRows` is wrapped in
  `useMemo(() => ..., [homeRoster])` because this page re-renders every 30 seconds from
  `usePolling` while a match is live, and recomputing the row layout on every one of those
  ticks (when the roster hasn't changed) would be wasted work.
- `components/CupRun.tsx` (Task 25): the deliberate contrast — no `useMemo` here, because
  filtering/sorting a handful of cup fixtures is cheap and nothing expensive consumes the
  result. `useMemo` is a fix for a measured cost, not a default.
