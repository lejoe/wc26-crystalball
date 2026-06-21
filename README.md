# FIFA World Cup 2026 — Prediction Tool

Single-page React + TypeScript app for predicting the World Cup 2026. Enter group
standings for all 12 groups, then predict the full knockout bracket. All state
persists to `localStorage`.

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

## Features

- **12 group tables** with inline editing. Enter W / D / L / GF / GA per team;
  PL, GD, and points auto-compute. Points can be overridden by typing in the Pts cell.
- **Tiebreaker cascade**: points → H2H points → H2H GD → H2H goals → overall GD →
  overall goals. Fair-play and FIFA ranking are out of scope; rows that reach them
  stay flagged with `*`.
- **Head-to-head resolution**: when teams tie on points, a "Resolve H2H" button
  opens a modal listing only the relevant matches. Entered results break the tie.
- **Best third-placed teams** ranked across all groups; top 8 highlighted.
- **Knockout bracket** with the official FIFA R32 → Final structure hardcoded.
  1st/2nd slots resolve from group standings (showing candidates while uncertain);
  third-place slots use a ranked dropdown filtered to the FIFA-allowed groups.
- **Winner prediction with cascade reset**: click a team to advance them; undoing a
  pick clears every downstream match that depended on it.

## Data

- Group teams and draw order: `src/data/groups.ts`
- Bracket structure: `src/data/bracket.ts`
  (source: 2026 FIFA World Cup knockout stage regulations)
- Tiebreaker / ranking logic: `src/standings.ts`
- Bracket resolution + cascade: `src/bracketResolve.ts`
- State + persistence: `src/store.ts`

## Out of scope (v1)

Match-by-match score entry, live scores, sharing, mobile-optimized layout, and
fair-play/FIFA-ranking as active tiebreakers.
