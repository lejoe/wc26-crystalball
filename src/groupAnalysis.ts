import { MATCHES } from './data/bracket'
import { FIXTURES } from './data/fixtures'
import { GROUP_LETTERS, GROUPS } from './data/groups'
import { effectiveH2H } from './h2h'
import { scenarioPositions } from './scenarios'
import { decidedOutcome, gdOf, groupStandings, pointsOf, rankGroup, rankThirdPlace } from './standings'
import type { GroupLetter, SlotSource, StatusTone, TeamStanding } from './types'

const NO_PRED = {} as Record<string, never>

type SimOutcome = 'H' | 'D' | 'A'
const SIM: SimOutcome[] = ['H', 'D', 'A']

export type { StatusTone }

/** A team's own result in its remaining match. */
export type OwnResult = 'win' | 'draw' | 'lose'

export type ResultFate = {
  /** Positions still reachable if the team takes this result (parallel match varying). */
  positions: number[]
  /** Top-2 guaranteed for this result regardless of the parallel same-group match. */
  guaranteedTop2: boolean
  /** Top-2 impossible for this result. */
  top2Impossible: boolean
  /** The fate of this result still hinges on the parallel same-group match. */
  dependsOnParallel: boolean
}

export type RemainingFacts = {
  opponent: string
  isHome: boolean
  /** Fixture index (4 or 5) of the team's remaining match. */
  matchIndex: number
  /** The other round-3 match in the group (the parallel match). */
  parallel: { home: string; away: string; matchIndex: number }
  results: Record<OwnResult, ResultFate>
  /** A win alone guarantees top 2, with no dependence on the parallel match. */
  selfSufficient: boolean
  /** Win / draw / lose lead to genuinely different fates (drives the W/D/L breakdown). */
  resultsDiffer: boolean
}

export type TeamFacts = {
  team: string
  position: number
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  status: StatusTone
  /** Positions (1-based) still mathematically reachable, points + H2H only. */
  reachable: number[]
  /** Can still finish 1st. */
  canWinGroup: boolean
  /** Top 2 guaranteed (== status 'through'). */
  guaranteedTop2: boolean
  /** Cannot finish top 2 but can still finish 3rd (best-3rd path alive). */
  cantTop2But3rdAlive: boolean
  remaining: RemainingFacts | null
}

/** Where a group's 1st / 2nd place feeds in the bracket, opponent slot left raw. */
export type BracketSlotFacts = {
  matchId: number
  round: string
  opponentSlot: SlotSource
}

export type ThirdPlaceFacts = {
  group: GroupLetter
  team: string
  points: number
  goalDifference: number
  goalsFor: number
  rank: number
}

export type GroupFacts = {
  group: GroupLetter
  /** Fingerprint of the real results this analysis is derived from. */
  fingerprint: string
  teams: TeamFacts[]
  /** Bracket destination of the group winner (1) and runner-up (2). */
  bracketSlots: { 1: BracketSlotFacts | null; 2: BracketSlotFacts | null }
}

export type AnalysisFacts = {
  groups: GroupFacts[]
  /** Cross-group best-3rd-place table over real results (lean input). */
  thirdPlaceTable: ThirdPlaceFacts[]
}

/**
 * A group is ready for analysis exactly when its first two rounds are played and
 * the final round is not: fixtures 0–3 carry real scores, 4–5 do not.
 */
export function analysisReady(group: GroupLetter): boolean {
  const fx = FIXTURES[group]
  const scored = (i: number) => fx[i].hs !== null && fx[i].as !== null
  return scored(0) && scored(1) && scored(2) && scored(3) && !scored(4) && !scored(5)
}

/** Stable fingerprint of a group's real scores, for per-group cache invalidation. */
export function groupFingerprint(group: GroupLetter): string {
  return FIXTURES[group].map((f) => (f.hs === null || f.as === null ? '-' : `${f.hs}:${f.as}`)).join('|')
}

function setH2H(h2h: Map<string, number>, home: string, away: string, o: SimOutcome): void {
  h2h.set(home + '|' + away, o === 'H' ? 3 : o === 'D' ? 1 : 0)
  h2h.set(away + '|' + home, o === 'A' ? 3 : o === 'D' ? 1 : 0)
}

type Scenario = {
  /** Remaining match outcomes, keyed by fixture index. */
  outcomes: Record<number, SimOutcome>
  positions: Map<string, Set<number>>
}

/** Enumerate every outcome of the group's remaining matches, recording each team's
 *  reachable position range (points + H2H only) per scenario. */
function enumerate(group: GroupLetter, standings: TeamStanding[]): { remaining: number[]; scenarios: Scenario[] } {
  const teams = GROUPS[group]
  const basePts = new Map(standings.map((s) => [s.team, pointsOf(s)]))
  const fixtures = FIXTURES[group].map((f, i) => ({ f, i, o: decidedOutcome(group, i, NO_PRED, NO_PRED) }))
  const decided = fixtures.filter((x) => x.o)
  const remaining = fixtures.filter((x) => !x.o)

  const scenarios: Scenario[] = []
  const total = 3 ** remaining.length
  for (let mask = 0; mask < total; mask++) {
    const pts = new Map(basePts)
    const h2h = new Map<string, number>()
    for (const { f, o } of decided) {
      setH2H(h2h, f.home, f.away, o === 'home' ? 'H' : o === 'away' ? 'A' : 'D')
    }
    let mm = mask
    const outcomes: Record<number, SimOutcome> = {}
    for (const { f, i } of remaining) {
      const o = SIM[mm % 3]
      mm = (mm / 3) | 0
      outcomes[i] = o
      setH2H(h2h, f.home, f.away, o)
      if (o === 'H') pts.set(f.home, pts.get(f.home)! + 3)
      else if (o === 'A') pts.set(f.away, pts.get(f.away)! + 3)
      else {
        pts.set(f.home, pts.get(f.home)! + 1)
        pts.set(f.away, pts.get(f.away)! + 1)
      }
    }
    scenarios.push({ outcomes, positions: scenarioPositions(teams, pts, h2h) })
  }
  return { remaining: remaining.map((x) => x.i), scenarios }
}

function classify(reachable: Set<number>): StatusTone {
  const max = Math.max(...reachable)
  const min = Math.min(...reachable)
  if (max <= 2) return 'through'
  if (min >= 4) return 'out'
  return 'in-balance'
}

function remainingFacts(
  team: string,
  group: GroupLetter,
  remainingIdx: number[],
  scenarios: Scenario[],
): RemainingFacts | null {
  const own = remainingIdx.find((i) => FIXTURES[group][i].home === team || FIXTURES[group][i].away === team)
  if (own === undefined) return null
  const f = FIXTURES[group][own]
  const isHome = f.home === team
  const opponent = isHome ? f.away : f.home
  const parallelIdx = remainingIdx.find((i) => i !== own)!
  const pf = FIXTURES[group][parallelIdx]

  const ownSim = (r: OwnResult): SimOutcome =>
    r === 'draw' ? 'D' : (r === 'win') === isHome ? 'H' : 'A'

  const results = {} as Record<OwnResult, ResultFate>
  for (const r of ['win', 'draw', 'lose'] as OwnResult[]) {
    const branches = scenarios.filter((s) => s.outcomes[own] === ownSim(r))
    const union = new Set<number>()
    let guaranteedTop2 = true
    let top2Impossible = true
    const perBranchTop2 = new Set<boolean>()
    for (const s of branches) {
      const pos = s.positions.get(team)!
      for (const p of pos) union.add(p)
      const branchTop2 = Math.max(...pos) <= 2
      const branchAlive = Math.min(...pos) <= 2
      if (!branchTop2) guaranteedTop2 = false
      if (branchAlive) top2Impossible = false
      perBranchTop2.add(branchTop2)
    }
    results[r] = {
      positions: [...union].sort((a, b) => a - b),
      guaranteedTop2,
      top2Impossible,
      dependsOnParallel: perBranchTop2.size > 1,
    }
  }

  const fateKey = (x: ResultFate) => `${x.guaranteedTop2}/${x.top2Impossible}/${x.positions.join(',')}`
  const resultsDiffer = new Set((['win', 'draw', 'lose'] as OwnResult[]).map((r) => fateKey(results[r]))).size > 1

  return {
    opponent,
    isHome,
    matchIndex: own,
    parallel: { home: pf.home, away: pf.away, matchIndex: parallelIdx },
    results,
    selfSufficient: results.win.guaranteedTop2 && !results.win.dependsOnParallel,
    resultsDiffer,
  }
}

function bracketSlots(group: GroupLetter): GroupFacts['bracketSlots'] {
  const out: GroupFacts['bracketSlots'] = { 1: null, 2: null }
  for (const m of MATCHES) {
    for (const side of ['a', 'b'] as const) {
      const s = m[side]
      if (s.kind === 'pos' && s.group === group) {
        out[s.pos] = { matchId: m.id, round: m.round, opponentSlot: side === 'a' ? m.b : m.a }
      }
    }
  }
  return out
}

/** Deterministic facts for one ready group. Throws if the group is not ready. */
export function groupAnalysisFacts(group: GroupLetter): GroupFacts {
  if (!analysisReady(group)) throw new Error(`Group ${group} is not in the ready window`)

  const standings = groupStandings(group, NO_PRED, NO_PRED)
  const h2h = effectiveH2H(NO_PRED, NO_PRED)
  const ranked = rankGroup(standings, h2h)
  const positionOf = new Map(ranked.map((r) => [r.standing.team, r.position]))

  const { remaining, scenarios } = enumerate(group, standings)
  const reachableOf = new Map<string, Set<number>>()
  for (const t of GROUPS[group]) reachableOf.set(t, new Set<number>())
  for (const s of scenarios) for (const [t, pos] of s.positions) for (const p of pos) reachableOf.get(t)!.add(p)

  const teams: TeamFacts[] = standings.map((s) => {
    const reach = reachableOf.get(s.team)!
    const status = classify(reach)
    const min = Math.min(...reach)
    return {
      team: s.team,
      position: positionOf.get(s.team)!,
      played: s.played,
      won: s.won,
      drawn: s.drawn,
      lost: s.lost,
      goalsFor: s.goalsFor,
      goalsAgainst: s.goalsAgainst,
      goalDifference: gdOf(s),
      points: pointsOf(s),
      status,
      reachable: [...reach].sort((a, b) => a - b),
      canWinGroup: reach.has(1),
      guaranteedTop2: status === 'through',
      cantTop2But3rdAlive: min >= 3 && reach.has(3),
      remaining: remainingFacts(s.team, group, remaining, scenarios),
    }
  })

  return {
    group,
    fingerprint: groupFingerprint(group),
    teams: teams.sort((a, b) => a.position - b.position),
    bracketSlots: bracketSlots(group),
  }
}

function thirdPlaceTable(): ThirdPlaceFacts[] {
  const groups = {} as Record<GroupLetter, TeamStanding[]>
  for (const g of GROUP_LETTERS) groups[g] = groupStandings(g, NO_PRED, NO_PRED)
  const h2h = effectiveH2H(NO_PRED, NO_PRED)
  return rankThirdPlace(groups, h2h).map((r) => ({
    group: r.group,
    team: r.standing.team,
    points: pointsOf(r.standing),
    goalDifference: gdOf(r.standing),
    goalsFor: r.standing.goalsFor,
    rank: r.rank,
  }))
}

/** Facts for every ready group plus the shared cross-group 3rd-place table. */
export function allGroupAnalysisFacts(): AnalysisFacts {
  return {
    groups: GROUP_LETTERS.filter(analysisReady).map(groupAnalysisFacts),
    thirdPlaceTable: thirdPlaceTable(),
  }
}
