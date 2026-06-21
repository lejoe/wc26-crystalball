# FIFA World Cup 2026 — Prediction Tool

A single-page app to track the World Cup 2026 group stage and predict the knockout
bracket. Past matches use their real results; you predict the rest. Everything
saves to `localStorage`.

## Install

```bash
npm install
```

## Usage

```bash
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build
```

## How it works

- **Group stage.** Each group shows a read-only standings table (computed). Open a
  group's **Matches** panel to set results: played matches are locked to their real
  score; for upcoming matches you pick the winner (or draw). The standings,
  tiebreakers, third-place ranking, and bracket update live.
- **Exact scores.** Only requested when needed — if two teams are level and the
  order comes down to goal difference, the group is flagged and the relevant
  matches gain score inputs (⚖ Scores).
- **Decided vs tentative.** A locked position shows 🔒; a spot still in play shows a
  dashed badge.
- **Third place.** The eight best third-placed teams are ranked and auto-assigned to
  the bracket's FIFA-allowed slots.
- **Knockout bracket.** A two-sided bracket from the official R32 → Final structure.
  Click a team to advance it; you can also advance an undecided (`?`) slot as a
  placeholder. Hover a `?` slot to see the possible teams.

## Tech

React 18, TypeScript, Vite, Zustand (state + persistence), Radix UI HoverCard.

## Project layout

```
src/
  data/        groups, fixtures (real results), bracket structure
  standings.ts standings + tiebreakers from results
  scenarios.ts clinch / reachable-position analysis
  h2h.ts       head-to-head records
  bracketResolve.ts  resolves each bracket slot + advancement
  store.ts     Zustand store (predictions, scores, bracket picks)
  components/  GroupTable, MatchesPanel, ThirdPlacePanel, Bracket
```

See [SPEC.md](SPEC.md) for the design principles.
