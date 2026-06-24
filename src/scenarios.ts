import { FIXTURES } from './data/fixtures'
import { GROUPS } from './data/groups'
import { decidedOutcome, groupStandings, pointsOf } from './standings'
import type { GroupLetter, Outcome, PredScore } from './types'

type SimOutcome = 'H' | 'D' | 'A'

export type GroupPositions = {
  /** position (1-based) → teams that can still finish there, ordered by current strength */
  candidates: Map<number, string[]>
}

/**
 * Enumerate every outcome (H/D/A) of a group's undecided matches and collect,
 * for each team, the set of final positions it can still reach. Tiebreaking
 * inside a scenario uses points then head-to-head points; ties that would fall
 * to goal difference stay ambiguous, so a position is only reported as a single
 * candidate when it is genuinely locked in.
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
    addPositions(teams, pts, h2h, reachable)
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

/**
 * The 1-based position range each team occupies in a single fully-decided
 * scenario, tiebreaking by points then head-to-head points only. Teams that a
 * lower tiebreaker (goal difference) would separate keep a shared range, so the
 * result reflects exactly what points + H2H can certify.
 */
export function scenarioPositions(
  teams: string[],
  pts: Map<string, number>,
  h2h: Map<string, number>,
): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>()
  teams.forEach((t) => out.set(t, new Set<number>()))
  const sorted = [...teams].sort((a, b) => pts.get(b)! - pts.get(a)!)
  let i = 0
  let pos = 1
  while (i < sorted.length) {
    let j = i
    while (j < sorted.length && pts.get(sorted[j]) === pts.get(sorted[i])) j++
    const block = sorted.slice(i, j)

    const sub = new Map<string, number>()
    for (const x of block) {
      let s = 0
      for (const y of block) if (x !== y) s += h2h.get(x + '|' + y) ?? 0
      sub.set(x, s)
    }
    const bs = [...block].sort((a, b) => sub.get(b)! - sub.get(a)!)
    let k = 0
    let sp = pos
    while (k < bs.length) {
      let l = k
      while (l < bs.length && sub.get(bs[l]) === sub.get(bs[k])) l++
      const tie = bs.slice(k, l)
      for (const t of tie) for (let p = sp; p < sp + tie.length; p++) out.get(t)!.add(p)
      sp += tie.length
      k = l
    }
    pos += block.length
    i = j
  }
  return out
}

function addPositions(
  teams: string[],
  pts: Map<string, number>,
  h2h: Map<string, number>,
  reachable: Map<string, Set<number>>,
): void {
  for (const [t, set] of scenarioPositions(teams, pts, h2h)) {
    for (const p of set) reachable.get(t)!.add(p)
  }
}
