# FIFA World Cup 2026 Prediction Tool — Principles

Single-page React + TypeScript + Vite app. All state in `localStorage`. No backend.

## Source of truth

- **Past matches**: real scores, fixed (from `FIXTURES`). Used in full everywhere (goal difference is real).
- **Upcoming matches**: the user predicts an **outcome** only (home / draw / away). An **exact score** is optional and only asked for when goal difference is actually needed to break a tie.
- Everything else (standings, third-place ranking, bracket slots) is **computed** from those, never stored.

## Group stage

- Standings are read-only: P/W/D/L/GF/GA/GD/Pts derived from results.
- Tiebreakers follow the WC cascade: points → head-to-head → overall goal difference → goals scored.
- Each position is flagged **decided** (locked) or **tentative** via clinch/scenario analysis over the remaining fixtures.
- A `*` + "predict exact scores" prompt appears only when a tie can't be broken without goal difference.
- Matches are edited in a per-group collapsible panel.

## Third place

- The 8 best third-placed teams are ranked (points → GD → goals) and **auto-assigned** to the bracket's third-place slots, respecting each slot's FIFA-allowed groups.

## Knockout bracket

- Official WC 2026 R32 → Final structure, hardcoded (`data/bracket.ts`).
- Two-sided symmetric layout fanning out from the central Final; responsive (fills width, stacks on mobile).
- **Side-based advancement**: you pick which side advances, so an undecided (`?`) slot can advance as a placeholder. Picks are path-based and re-resolve as group results change.
- Unknown slots show their candidate teams in a hover card.

## Out of scope

Live data sync, sharing, accounts. Fair-play / FIFA-ranking tiebreakers (ties that reach them stay flagged).
