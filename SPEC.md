# FIFA World Cup 2026 Prediction Tool — Spec

## Overview

Single-page React + TypeScript app. Top half: group standings for all 12 groups. Bottom half: knockout bracket. All state persists to `localStorage`. Accepts partial data everywhere.

---

## Tournament Structure (WC 2026 rules)

- 48 teams, 12 groups (A–L), 4 teams each
- 3 group-stage matches per team
- Advancement: 1st + 2nd from each group (24 teams) + 8 best 3rd-place teams = **32 teams in Round of 32**
- Knockout: R32 → R16 → QF → SF → Final (5 rounds, 31 matches)

### Tiebreaker order (within a group, among tied teams)

1. Head-to-head points
2. Head-to-head goal difference
3. Head-to-head goals scored
4. Overall goal difference
5. Overall goals scored
6. Fair-play score (yellow/red cards)
7. FIFA World Ranking

### Tiebreaker order (ranking 3rd-place teams across all groups)

1. Points
2. Goal difference
3. Goals scored
4. Fair-play score
5. FIFA World Ranking

---

## Groups (A–L)

| Group | Teams |
|-------|-------|
| A | Mexico, South Africa, Korea Republic, Czechia |
| B | Canada, Switzerland, Qatar, Bosnia and Herzegovina |
| C | Brazil, Morocco, Haiti, Scotland |
| D | United States, Paraguay, Australia, Türkiye |
| E | Germany, Curaçao, Côte d'Ivoire, Ecuador |
| F | Netherlands, Japan, Tunisia, Sweden |
| G | Belgium, Egypt, Iran, New Zealand |
| H | Spain, Cabo Verde, Saudi Arabia, Uruguay |
| I | France, Senegal, Norway, Iraq |
| J | Argentina, Algeria, Austria, Jordan |
| K | Portugal, Uzbekistan, Colombia, Congo DR |
| L | England, Croatia, Ghana, Panama |

---

## Data Model

### Per-team group data (user-entered)

```ts
type TeamStanding = {
  team: string
  played: number          // games played (0–3)
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number          // auto-computed: 3W + 1D, but allow manual override
  // head-to-head only needed when tiebreaker resolution requires it
}
```

### Head-to-head data (optional, only prompted when needed)

```ts
type H2HRecord = {
  teamA: string
  teamB: string
  pointsA: number   // 0, 1, or 3
  gdA: number       // goal diff from that match for A
  goalsA: number
}
```

H2H input is only surfaced in the UI when two or more teams in the same group are tied on points and the tiebreaker requires it.

### Bracket state

```ts
type BracketSlot = {
  team: string | null           // null = unknown
  candidates: string[]          // 2–3 likely teams when unknown
  source: SlotSource            // e.g. { type: '1st', group: 'C' } | { type: '3rd-best', rank: 2 }
}

type Match = {
  id: string
  home: BracketSlot
  away: BracketSlot
  winner: string | null         // null = not yet predicted
}
```

---

## Group Stage UI

### Layout

Grid of all 12 group tables visible simultaneously (e.g. 4 columns × 3 rows on desktop). No tabs or pagination.

### Per-group table

| Pos | Team | PL | W | D | L | GF | GA | GD | Pts |
|-----|------|----|----|---|---|----|----|----|-----|
| 1 | Brazil | 2 | 2 | 0 | 0 | 5 | 1 | +4 | 6 |
| 2 | Morocco | 2 | 1 | 0 | 1 | 2 | 3 | -1 | 3 |
| ... | | | | | | | | | |

- Position is auto-computed from entered data using the tiebreaker cascade
- Teams with 0 played appear in their original draw order
- Partial data is fine: a team with no data sits at the bottom
- Top 2 rows highlighted (advance), 3rd row highlighted differently (potential 3rd-best), 4th row normal

### Editing

- Click any cell to edit (inline, number input)
- `points` auto-computes from W/D/L but can be overridden
- GD is derived from GF − GA (not independently editable)

### H2H resolution

When two or more teams are tied on points and the tiebreaker requires H2H data:
- A small modal/drawer appears showing only the relevant head-to-head match(es) to fill in
- If H2H data would separate them, apply it; otherwise fall through to next criterion
- Show a subtle indicator on tied rows (e.g. asterisk) when H2H data is missing and rank is unresolved

### 3rd-place tracking

- A separate section below the groups (or sidebar) shows all 12 third-placed teams ranked by the 3rd-place tiebreaker
- Top 8 are highlighted as "advancing (pending)"
- Since user manually selects which 8 advance (see Bracket UI), this ranking is advisory

---

## Bracket UI

### Round of 32 seeding

The R32 matchups are pre-determined by FIFA (hardcoded). Each slot maps to a specific group result:
- e.g. Match R32-1: 1A vs 2B, Match R32-2: 1C vs 2D, etc.
- The 8 slots reserved for 3rd-place teams are spread across specific R32 matches (also per FIFA rules)

> **Open question**: The exact R32 bracket structure (which group positions face each other) must be sourced from the official FIFA bracket. Hardcode this as a constant.

### Slot display when uncertain

Each bracket slot shows:
- If qualifier is known: team name + flag/badge
- If qualifier is unknown: `"1st Group C — Brazil / Morocco?"` (group label + 2–3 candidates derived from current standings)

Candidates are the top 2–3 teams by current points in the relevant group.

### 3rd-place slot assignment

When a bracket slot is designated for a 3rd-place team:
- Show a "Select 3rd-place qualifier" dropdown/picker listing all 12 third-placed teams, ranked by the advisory ranking
- User picks which team goes there; this can be changed

### Predicting winners

- Click a team in a match to mark them as the winner → they advance to the next round
- Their opponent slot is cleared/greyed out
- Undo: click the winner again, or click the opponent — resets both this match and all downstream matches that depended on this pick (cascade reset)

### Cascade reset

When a prediction is undone at round R, all matches in rounds R+1 through Final that had this team in a slot are cleared back to "uncertain".

---

## State Management

Single top-level state object in React context (or Zustand):

```ts
type AppState = {
  groups: Record<GroupLetter, TeamStanding[]>   // A–L
  h2h: H2HRecord[]
  thirdPlaceSelections: Record<BracketSlotId, string | null>  // which 3rd-place team fills each R32 slot
  bracketPredictions: Record<MatchId, string | null>          // winner per match
}
```

Serialized to `localStorage` on every change. On load, merge from `localStorage` (partial data welcome).

---

## Tech Stack

- **React 18 + TypeScript**
- **Vite** (dev server + build)
- **CSS Modules or Tailwind** — TBD
- No backend; no auth; no sharing

---

## Out of Scope (v1)

- Match-by-match score entry (standings entered directly)
- Real-time data sync / live scores
- Multiple users / sharing links
- Mobile-optimized layout (desktop first)
- Fair-play score and FIFA ranking as active tiebreakers (show as fallback text "requires FIFA ranking" when reached)
