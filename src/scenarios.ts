import { FIXTURES } from './data/fixtures'
import { GROUPS } from './data/groups'
import { decidedOutcome, groupStandings, knownScore, pointsOf } from './standings'
import type { GroupLetter, Outcome, PredScore } from './types'

type SimOutcome = 'H' | 'D' | 'A'

export type GroupPositions = {
  /** position (1-based) → teams that can still finish there, ordered by current strength */
  candidates: Map<number, string[]>
}

/**
 * Enumerate every outcome (H/D/A) of a group's undecided matches and collect,
 * for each team, the set of final positions it can still reach. While matches
 * remain, tiebreaking inside a scenario uses points then head-to-head points;
 * ties that would fall to goal difference stay ambiguous, since simulated
 * outcomes carry no scores. Once the group is fully played with known scores,
 * goal difference is final and positions are split by the full cascade, so each
 * team resolves to its single real position.
 */
export function possibleGroupPositions(
  group: GroupLetter,
  predictions: Record<string, Outcome>,
  predScores: Record<string, PredScore> = {},
): GroupPositions {
  const teams = GROUPS[group]
  const standings = groupStandings(group, predictions, predScores)
  const basePts = new Map(standings.map((s) => [s.team, pointsOf(s)]))

  const fixtures = FIXTURES[group].map((f, i) => ({ f, o: decidedOutcome(group, i, predictions, predScores) }))
  const decided = fixtures.filter((x) => x.o)
  const remaining = fixtures.filter((x) => !x.o)

  // When the group is fully decided AND every match has a known score, goal
  // difference is final, so positions can be split by the full tiebreak cascade
  // rather than left ambiguous at the points + head-to-head stage. Outcome-only
  // predictions carry no goals, so GD stays unknown and we skip this.
  const allScored =
    remaining.length === 0 &&
    FIXTURES[group].every((_, i) => knownScore(group, i, predScores) !== undefined)
  const goals = allScored
    ? new Map(standings.map((s) => [s.team, { gd: s.goalsFor - s.goalsAgainst, gf: s.goalsFor }]))
    : undefined

  const reachable = new Map<string, Set<number>>()
  teams.forEach((t) => reachable.set(t, new Set<number>()))

  const setH2H = (h2h: Map<string, number>, home: string, away: string, o: SimOutcome) => {
    h2h.set(home + '|' + away, o === 'H' ? 3 : o === 'D' ? 1 : 0)
    h2h.set(away + '|' + home, o === 'A' ? 3 : o === 'D' ? 1 : 0)
  }

  const total = 3 ** remaining.length
  for (let mask = 0; mask < total; mask++) {
    const pts = new Map(basePts)
    const h2h = new Map<string, number>()
    for (const { f, o } of decided) {
      setH2H(h2h, f.home, f.away, o === 'home' ? 'H' : o === 'away' ? 'A' : 'D')
    }
    let mm = mask
    for (const { f } of remaining) {
      const o = (['H', 'D', 'A'] as SimOutcome[])[mm % 3]
      mm = (mm / 3) | 0
      setH2H(h2h, f.home, f.away, o)
      if (o === 'H') pts.set(f.home, (pts.get(f.home) ?? 0) + 3)
      else if (o === 'A') pts.set(f.away, (pts.get(f.away) ?? 0) + 3)
      else {
        pts.set(f.home, (pts.get(f.home) ?? 0) + 1)
        pts.set(f.away, (pts.get(f.away) ?? 0) + 1)
      }
    }
    addPositions(teams, pts, h2h, reachable, goals)
  }

  const order = [...teams].sort((a, b) => (basePts.get(b)! - basePts.get(a)!))
  const rank = new Map(order.map((t, i) => [t, i]))
  const candidates = new Map<number, string[]>()
  for (let p = 1; p <= teams.length; p++) {
    const list = teams.filter((t) => reachable.get(t)!.has(p))
    list.sort((a, b) => rank.get(a)! - rank.get(b)!)
    candidates.set(p, list)
  }
  return { candidates }
}

/** A team's qualification outlook within its group. */
export type QualStatus = 'through' | 'balance' | 'out' | 'open'

/**
 * Classify each team's qualification outlook from the positions it can still
 * reach: guaranteed top 2 → through, can't reach top 3 → out, anything that
 * still straddles the line → in the balance. Before a group has any results
 * every team is "open".
 */
export function qualificationStatus(
  group: GroupLetter,
  predictions: Record<string, Outcome>,
  predScores: Record<string, PredScore> = {},
): Map<string, QualStatus> {
  const teams = GROUPS[group]
  const standings = groupStandings(group, predictions, predScores)
  if (standings.every((s) => s.played === 0)) {
    return new Map(teams.map((t) => [t, 'open']))
  }

  const { candidates } = possibleGroupPositions(group, predictions, predScores)
  const reach = new Map<string, number[]>()
  for (const [pos, list] of candidates) {
    for (const t of list) {
      const arr = reach.get(t)
      if (arr) arr.push(pos)
      else reach.set(t, [pos])
    }
  }

  const out = new Map<string, QualStatus>()
  for (const t of teams) {
    const ps = reach.get(t)
    if (!ps || ps.length === 0) {
      out.set(t, 'open')
      continue
    }
    const max = Math.max(...ps)
    const min = Math.min(...ps)
    out.set(t, max <= 2 ? 'through' : min >= 4 ? 'out' : 'balance')
  }
  return out
}

/** Final goal difference and goals-for for a fully-decided group. */
export type GoalStat = { gd: number; gf: number }

/**
 * The 1-based position range each team occupies in a single fully-decided
 * scenario, tiebreaking by points then head-to-head points. When `goals` is
 * supplied — only safe once every match has a known score, so goal difference
 * is final — ties that head-to-head leaves are further split by overall goal
 * difference then goals-for. Without it, teams a lower tiebreaker would separate
 * keep a shared range, reflecting exactly what points + H2H can certify.
 */
export function scenarioPositions(
  teams: string[],
  pts: Map<string, number>,
  h2h: Map<string, number>,
  goals?: Map<string, GoalStat>,
): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>()
  teams.forEach((t) => out.set(t, new Set<number>()))

  // Assign every team in `block` the shared range [start, start + len - 1].
  const flat = (block: string[], start: number) => {
    for (const t of block) for (let p = start; p < start + block.length; p++) out.get(t)!.add(p)
  }

  // Split `block` into runs of equal `score` (higher is better), recursing into
  // `next` for teams that remain tied. `score` may read the block (head-to-head
  // mini-tables are relative to the points-tied cluster).
  const split = (
    block: string[],
    start: number,
    score: (t: string, peers: string[]) => number,
    next: (sub: string[], s: number) => void,
  ) => {
    const ranked = [...block].sort((a, b) => score(b, block) - score(a, block))
    let i = 0
    let pos = start
    while (i < ranked.length) {
      let j = i
      while (j < ranked.length && score(ranked[j], block) === score(ranked[i], block)) j++
      next(ranked.slice(i, j), pos)
      pos += j - i
      i = j
    }
  }

  const h2hScore = (t: string, peers: string[]) => {
    let s = 0
    for (const y of peers) if (y !== t) s += h2h.get(t + '|' + y) ?? 0
    return s
  }

  // After points → H2H, optionally break remaining ties by GD then GF.
  const byGoals = (sub: string[], s: number) =>
    goals
      ? split(sub, s, (t) => goals.get(t)!.gd, (g, gs) =>
          split(g, gs, (t) => goals.get(t)!.gf, flat))
      : flat(sub, s)

  split(teams, 1, (t) => pts.get(t)!, (block, s) => split(block, s, h2hScore, byGoals))
  return out
}

function addPositions(
  teams: string[],
  pts: Map<string, number>,
  h2h: Map<string, number>,
  reachable: Map<string, Set<number>>,
  goals?: Map<string, GoalStat>,
): void {
  for (const [t, set] of scenarioPositions(teams, pts, h2h, goals)) {
    for (const p of set) reachable.get(t)!.add(p)
  }
}
