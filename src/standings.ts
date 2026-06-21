import { FIXTURES, resultKey } from './data/fixtures'
import { GROUPS } from './data/groups'
import type { GroupLetter, H2HRecord, Outcome, PredScore, TeamStanding } from './types'

const NO_SCORES: Record<string, PredScore> = {}

export function pointsOf(s: TeamStanding): number {
  return s.won * 3 + s.drawn
}

export function gdOf(s: TeamStanding): number {
  return s.goalsFor - s.goalsAgainst
}

export function hasData(s: TeamStanding): boolean {
  return s.played > 0
}

function emptyStanding(team: string): TeamStanding {
  return { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 }
}

/**
 * The decided outcome of a fixture: the real result for past matches, the
 * predicted outcome for upcoming ones, or undefined when not yet predicted.
 */
/**
 * The score of a fixture, if known: the real score for a past match, or a
 * predicted exact score the user entered for an upcoming one.
 */
export function knownScore(
  group: GroupLetter,
  index: number,
  predScores: Record<string, PredScore>,
): PredScore | undefined {
  const f = FIXTURES[group][index]
  if (f.hs !== null && f.as !== null) return { hs: f.hs, as: f.as }
  return predScores[resultKey(group, index)]
}

/**
 * The decided outcome of a fixture: from the real/predicted score if one
 * exists, otherwise the picked outcome, otherwise undefined.
 */
export function decidedOutcome(
  group: GroupLetter,
  index: number,
  predictions: Record<string, Outcome>,
  predScores: Record<string, PredScore> = NO_SCORES,
): Outcome | undefined {
  const s = knownScore(group, index, predScores)
  if (s) return s.hs > s.as ? 'home' : s.hs < s.as ? 'away' : 'draw'
  return predictions[resultKey(group, index)]
}

/**
 * Compute a group's standings. Matches with a known score (played, or a
 * predicted exact score) contribute their goals; outcome-only predictions
 * contribute the result but no goals.
 */
export function groupStandings(
  group: GroupLetter,
  predictions: Record<string, Outcome>,
  predScores: Record<string, PredScore> = NO_SCORES,
): TeamStanding[] {
  const byTeam = new Map(GROUPS[group].map((t) => [t, emptyStanding(t)]))
  FIXTURES[group].forEach((f, i) => {
    const o = decidedOutcome(group, i, predictions, predScores)
    if (!o) return
    const score = knownScore(group, i, predScores)
    const home = byTeam.get(f.home)!
    const away = byTeam.get(f.away)!
    home.played++
    away.played++
    if (score) {
      home.goalsFor += score.hs
      home.goalsAgainst += score.as
      away.goalsFor += score.as
      away.goalsAgainst += score.hs
    }
    if (o === 'home') {
      home.won++
      away.lost++
    } else if (o === 'away') {
      away.won++
      home.lost++
    } else {
      home.drawn++
      away.drawn++
    }
  })
  return GROUPS[group].map((t) => byTeam.get(t)!)
}

/** True when every match in a group is decided (played or predicted). */
export function groupComplete(
  group: GroupLetter,
  predictions: Record<string, Outcome>,
  predScores: Record<string, PredScore> = NO_SCORES,
): boolean {
  return FIXTURES[group].every((_, i) => decidedOutcome(group, i, predictions, predScores) !== undefined)
}

/** Teams whose goal difference is incomplete: they have an outcome-only (scoreless) predicted match. */
export function incompleteGoalsTeams(
  group: GroupLetter,
  predictions: Record<string, Outcome>,
  predScores: Record<string, PredScore> = NO_SCORES,
): Set<string> {
  const out = new Set<string>()
  FIXTURES[group].forEach((f, i) => {
    if (knownScore(group, i, predScores)) return // played or has a predicted score
    if (predictions[resultKey(group, i)]) {
      out.add(f.home)
      out.add(f.away)
    }
  })
  return out
}

export type RankedRow = {
  standing: TeamStanding
  position: number // 1-based
  /** true when the order vs a level team is decided by goal difference but that
   *  GD is not yet certain — an exact score for a predicted match is needed. */
  needsScores: boolean
  /** true when tied teams remain inseparable even with full scores. */
  unresolved: boolean
}

type H2HStat = { pts: number; gd: number; gf: number }

/** Aggregate H2H mini-table stats for `team` against the other tied teams. */
function h2hStats(
  team: string,
  others: Set<string>,
  records: H2HRecord[],
): { stat: H2HStat; missing: number } {
  const stat: H2HStat = { pts: 0, gd: 0, gf: 0 }
  let found = 0
  for (const r of records) {
    let pts = 0
    let gd = 0
    let gf = 0
    if (r.teamA === team && others.has(r.teamB)) {
      pts = r.pointsA
      gd = r.gdA
      gf = r.goalsA
    } else if (r.teamB === team && others.has(r.teamA)) {
      pts = r.pointsA === 3 ? 0 : r.pointsA === 0 ? 3 : 1
      gd = -r.gdA
      gf = r.goalsA - r.gdA // goalsB = goalsA - gdA
    } else {
      continue
    }
    stat.pts += pts
    stat.gd += gd
    stat.gf += gf
    found++
  }
  const expected = others.size // each team plays every other tied team once
  return { stat, missing: Math.max(0, expected - found) }
}

/**
 * Rank a group's teams using the SPEC tiebreaker cascade:
 *   points → H2H pts → H2H gd → H2H gf → overall gd → overall gf → (unresolved).
 * Fair-play and FIFA ranking are out of scope; rows that reach them stay tied.
 */
export function rankGroup(
  standings: TeamStanding[],
  h2h: H2HRecord[],
  incompleteGoals: Set<string> = new Set(),
): RankedRow[] {
  const order = new Map(standings.map((s, i) => [s.team, i]))
  const drawIndex = (s: TeamStanding) => order.get(s.team) ?? 0

  // Pre-compute H2H stats per points-tied cluster.
  const byPoints = new Map<number, TeamStanding[]>()
  for (const s of standings) {
    const p = pointsOf(s)
    const arr = byPoints.get(p) ?? []
    arr.push(s)
    byPoints.set(p, arr)
  }

  const statCache = new Map<string, { stat: H2HStat; missing: number }>()
  // A cluster only needs resolution when 2+ of its teams have actual data.
  const clusterActive = new Map<number, boolean>()
  for (const [p, arr] of byPoints) {
    clusterActive.set(p, arr.filter(hasData).length >= 2)
    if (arr.length < 2) continue
    const names = new Set(arr.map((s) => s.team))
    for (const s of arr) {
      const others = new Set(names)
      others.delete(s.team)
      statCache.set(s.team, h2hStats(s.team, others, h2h))
    }
  }

  const sorted = [...standings].sort((a, b) => {
    const pa = pointsOf(a)
    const pb = pointsOf(b)
    if (pa !== pb) return pb - pa

    // Same points → tiebreaker cascade.
    const sa = statCache.get(a.team)?.stat
    const sb = statCache.get(b.team)?.stat
    if (sa && sb) {
      if (sa.pts !== sb.pts) return sb.pts - sa.pts
      if (sa.gd !== sb.gd) return sb.gd - sa.gd
      if (sa.gf !== sb.gf) return sb.gf - sa.gf
    }
    if (gdOf(a) !== gdOf(b)) return gdOf(b) - gdOf(a)
    if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor
    return drawIndex(a) - drawIndex(b) // stable fallback (draw order)
  })

  return sorted.map((standing, i) => {
    const p = pointsOf(standing)
    const cluster = byPoints.get(p) ?? []
    const active = (clusterActive.get(p) ?? false) && hasData(standing)
    const tied = cluster.length > 1 && active

    // Look at every same-points team whose head-to-head doesn't separate it from
    // this one. If their goal data is incomplete, an exact score is needed;
    // if it's complete and still equal, the tie is genuinely unresolved.
    let needsScores = false
    let unresolved = false
    if (tied) {
      const ss = statCache.get(standing.team)?.stat
      for (const n of cluster) {
        if (n.team === standing.team || !hasData(n)) continue
        const sn = statCache.get(n.team)?.stat
        const h2hEqual =
          !sn || !ss || (sn.pts === ss.pts && sn.gd === ss.gd && sn.gf === ss.gf)
        if (!h2hEqual) continue
        if (incompleteGoals.has(standing.team) || incompleteGoals.has(n.team)) {
          needsScores = true
        } else if (gdOf(n) === gdOf(standing) && n.goalsFor === standing.goalsFor) {
          unresolved = true
        }
      }
    }

    return { standing, position: i + 1, needsScores, unresolved }
  })
}

export type ThirdPlaceRow = {
  group: GroupLetter
  standing: TeamStanding
  rank: number // 1-based across all 12 groups
}

/**
 * Rank the third-placed team of each group by: points → gd → gf.
 * Groups with no determinable 3rd-place team (no data) are omitted.
 */
export function rankThirdPlace(
  groups: Record<GroupLetter, TeamStanding[]>,
  h2h: H2HRecord[],
): ThirdPlaceRow[] {
  const thirds: { group: GroupLetter; standing: TeamStanding }[] = []
  for (const g of Object.keys(groups) as GroupLetter[]) {
    const ranked = rankGroup(groups[g], h2h)
    const third = ranked.find((r) => r.position === 3)
    if (third && hasData(third.standing)) {
      thirds.push({ group: g, standing: third.standing })
    }
  }

  thirds.sort((a, b) => {
    const pa = pointsOf(a.standing)
    const pb = pointsOf(b.standing)
    if (pa !== pb) return pb - pa
    if (gdOf(a.standing) !== gdOf(b.standing)) return gdOf(b.standing) - gdOf(a.standing)
    if (a.standing.goalsFor !== b.standing.goalsFor) return b.standing.goalsFor - a.standing.goalsFor
    return a.group.localeCompare(b.group)
  })

  return thirds.map((t, i) => ({ ...t, rank: i + 1 }))
}
