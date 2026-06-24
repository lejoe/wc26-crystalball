import { resolveBracket, type MatchView } from './bracketResolve'
import { FIXTURES } from './data/fixtures'
import { GROUPS, GROUP_LETTERS, groupCandidatesByGroup } from './data/groups'
import {
  analysisReady,
  enumerate,
  groupAnalysisFacts,
  groupFingerprint,
  type OwnResult,
  type Scenario,
} from './groupAnalysis'
import { effectiveH2H } from './h2h'
import { gdOf, groupStandings, pointsOf, rankThirdPlace } from './standings'
import type { AppState, GroupLetter, SlotSource, TeamStanding } from './types'

// ── Node model (the interactive drill-down tree the modal walks) ─────────────
// Generated at runtime from the deterministic engine, so it is correct by
// construction and auto-updates when results change.
export type Zone = 'good' | 'mid' | 'bad'

/** Bucketed R32 opponents baked into a leaf at build time. */
export type OpponentList = { kind: 'runnerUp' | 'thirds'; groups: { g: GroupLetter; teams: string[] }[] }

export type EndNode = {
  type: 'end'
  place: string
  zone: Zone
  /** Engine position set this leaf represents (1-based). Backs the dev assertion. */
  set: number[]
  opponents?: OpponentList
  /** A 3rd-place finish with best-third qualification still open. */
  third?: {
    /** Hypothetical final points for this team in this branch. */
    points: number
    /** Final goal difference, when this branch pins it down (a draw). */
    gd?: number
  }
  text?: string
}

/** A row of the live best-third race (real current results, no predictions). */
export type ThirdRaceRow = {
  rank: number
  group: GroupLetter
  team: string
  points: number
  gd: number
  /** The team still has a group match to play — its place can change. */
  toPlay: boolean
}
export type Opt = { label: string; place: string; zone: Zone; child: Node }
export type ChoiceNode = {
  type: 'choice'
  kind: 'own' | 'parallel'
  /** The two sides of the fixture, in home–away order. */
  home: string
  away: string
  /** Parallel matches only: the team whose win is the subject's best outcome. */
  rootFor?: string
  options: Opt[]
}
/** Interactive goal-difference battle: both tied teams win distinct final games. */
export type MarginsNode = {
  type: 'margins'
  note: string
  self: { team: string; gd: number }
  rival: { team: string; gd: number }
  set: number[]
  /** Strict goal-difference win → the better place. */
  win: EndNode
  /** A tie isn't enough → the worse place. */
  lose: EndNode
}
/** Non-interactive goal-difference resolution (a draw or fixed-margin tie). */
export type GdNoteNode = {
  type: 'gdnote'
  self: { team: string; gd: number }
  rival: { team: string; gd: number }
  set: number[]
  result: EndNode
}
export type Node = ChoiceNode | EndNode | MarginsNode | GdNoteNode

type SimOutcome = 'H' | 'D' | 'A'
const NO_PRED = {} as Record<string, never>
const EMPTY_STATE: AppState = { predictions: {}, predScores: {}, bracketPredictions: {} }

export const THIRDS_ADVANCE = 8

/** The live best-third race from real results only (no predictions). Memoised. */
let raceRows: ThirdRaceRow[] | null = null
export function bestThirdRace(): ThirdRaceRow[] {
  if (raceRows) return raceRows
  const groups = {} as Record<GroupLetter, TeamStanding[]>
  for (const g of GROUP_LETTERS) groups[g] = groupStandings(g, NO_PRED, NO_PRED)
  raceRows = rankThirdPlace(groups, effectiveH2H(NO_PRED, NO_PRED)).map((r) => ({
    rank: r.rank,
    group: r.group,
    team: r.standing.team,
    points: pointsOf(r.standing),
    gd: gdOf(r.standing),
    toPlay: r.standing.played < GROUPS[r.group].length - 1,
  }))
  return raceRows
}

// ── small helpers ────────────────────────────────────────────────────────────
const sortSet = (s: Set<number>): number[] => [...s].sort((a, b) => a - b)
const eqSet = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])
const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const ORD: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' }
const ZONE_RANK: Record<Zone, number> = { good: 0, mid: 1, bad: 2 }

function zoneOf(set: number[]): Zone {
  const u = [...new Set(set)]
  const mn = Math.min(...u)
  const mx = Math.max(...u)
  if (mx <= 2) return 'good'
  if (mn <= 2) return 'mid'
  if (u.includes(3)) return 'mid' // a live 3rd-place (best-third) path
  return 'bad'
}

/** 4th = "Out". A range keeps 3rd visible, e.g. {3,4} → "3rd / Out". */
function placeLabel(set: number[]): string {
  const u = [...new Set(set)].sort((a, b) => a - b)
  const name = (p: number) => (p >= 4 ? 'Out' : ORD[p])
  if (u.length === 1) return name(u[0])
  return `${name(u[0])} / ${name(u[u.length - 1])}`
}

/**
 * Positions an option's chip should advertise. A `gdnote` is deterministic, so it
 * collapses to its single resolved place rather than the engine's raw points+H2H
 * tie (e.g. a draw that GD settles shows "2nd", not "1st / 2nd"). A `margins`
 * battle stays a range — the user sets it. A `choice` unions its children.
 */
function displaySet(node: Node): number[] {
  switch (node.type) {
    case 'end':
      return node.set
    case 'gdnote':
      return node.result.set
    case 'margins':
      return node.set
    case 'choice':
      return [...new Set(node.options.flatMap((o) => displaySet(o.child)))].sort((a, b) => a - b)
  }
}

/** The terminal a node lands on when it's deterministic (a leaf or a gdnote). */
function effEnd(node: Node): EndNode | null {
  if (node.type === 'end') return node
  if (node.type === 'gdnote') return node.result
  return null
}

/**
 * Drop a "watch the parallel match" step that doesn't change the outcome: if
 * every branch of a parallel ChoiceNode lands on the same single place, collapse
 * it to that terminal. Also recomputes child chips after simplifying.
 */
function simplify(node: Node): Node {
  if (node.type !== 'choice') return node
  const options: Opt[] = node.options.map((o) => {
    const child = simplify(o.child)
    const ds = displaySet(child)
    return { label: o.label, place: placeLabel(ds), zone: zoneOf(ds), child }
  })
  if (node.kind === 'parallel' && displaySet({ ...node, options }).length === 1) {
    return effEnd(options[0].child) ?? options[0].child
  }
  options.sort((a, b) => ZONE_RANK[a.zone] - ZONE_RANK[b.zone])
  return { ...node, options }
}

/** Phrase a subset of parallel-match outcomes as a rooting condition. */
function parallelLabel(outs: SimOutcome[], home: string, away: string): string {
  const set = new Set(outs)
  if (set.size === 3) return 'Any result'
  if (set.size === 1) {
    const o = outs[0]
    return o === 'D' ? 'Draw' : `${o === 'H' ? home : away} win`
  }
  if (set.has('D') && set.has('H')) return `${home} win or draw`
  if (set.has('D') && set.has('A')) return `${away} win or draw`
  return `${home} or ${away} win`
}

/** Merge-label for an own-result option, from which results share its sub-tree. */
function ownLabel(results: OwnResult[]): string {
  const s = new Set(results)
  if (s.size === 3) return 'Any result'
  if (s.size === 1) return results[0] === 'win' ? 'Win' : results[0] === 'draw' ? 'Draw' : 'Lose'
  if (s.has('win') && s.has('draw')) return 'Win or draw'
  if (s.has('draw') && s.has('lose')) return 'Draw or lose'
  return 'Win or lose'
}

// ── generator ────────────────────────────────────────────────────────────────
const cache = new Map<GroupLetter, { fp: string; trees: Record<string, Node> }>()

/** Per-team interactive scenario tree for a ready group, memoized by fingerprint. */
export function buildGroupScenarios(group: GroupLetter): Record<string, Node> {
  if (!analysisReady(group)) return {}
  const fp = groupFingerprint(group)
  const hit = cache.get(group)
  if (hit && hit.fp === fp) return hit.trees
  const trees = build(group)
  cache.set(group, { fp, trees })
  return trees
}

function build(group: GroupLetter): Record<string, Node> {
  const facts = groupAnalysisFacts(group)
  const standings = groupStandings(group, NO_PRED, NO_PRED)
  const { scenarios } = enumerate(group, standings)
  const views = resolveBracket(EMPTY_STATE)
  const teams = GROUPS[group]
  const gdByTeam = new Map(facts.teams.map((t) => [t.team, t.goalDifference]))
  const ptsByTeam = new Map(facts.teams.map((t) => [t.team, t.points]))

  /** Bracket opponents for finishing 1st (pos 1) or 2nd (pos 2). */
  function oppList(pos: 1 | 2): OpponentList | undefined {
    const slot = facts.bracketSlots[pos]
    if (!slot) return undefined
    const mv: MatchView | undefined = views[slot.matchId]
    if (!mv) return undefined
    const oppView = mv.def.a === slot.opponentSlot ? mv.a : mv.b
    const list = oppView.team ? [oppView.team] : oppView.candidates
    const kind: OpponentList['kind'] = (slot.opponentSlot as SlotSource).kind === 'third' ? 'thirds' : 'runnerUp'
    return { kind, groups: groupCandidatesByGroup(list) }
  }

  const trees: Record<string, Node> = {}
  for (const team of teams) {
    const node = buildTeam(team)
    if (node) trees[team] = node
  }
  return trees

  function buildTeam(team: string): Node | null {
    const tf = facts.teams.find((t) => t.team === team)
    if (!tf || !tf.remaining) return null
    const rem = tf.remaining
    const ownIdx = rem.matchIndex
    const parIdx = rem.parallel.matchIndex
    const isHome = rem.isHome
    const parHome = rem.parallel.home
    const parAway = rem.parallel.away
    const ownFx = FIXTURES[group][ownIdx]
    const tGD = gdByTeam.get(team) ?? 0
    const tPts = ptsByTeam.get(team) ?? 0
    const ownSim = (r: OwnResult): SimOutcome => (r === 'draw' ? 'D' : r === 'win' === isHome ? 'H' : 'A')
    const ptsFor = (r: OwnResult) => tPts + (r === 'win' ? 3 : r === 'draw' ? 1 : 0)

    // Terminals collected for the dev-only assertion (own result + the parallel
    // outcomes that lead to each leaf, with its certified position set).
    const terminals: { own: OwnResult; pars: SimOutcome[]; set: number[] }[] = []

    function leaf(set: number[], own: OwnResult, pars: SimOutcome[]): EndNode {
      terminals.push({ own, pars, set })
      return endNode(set, own)
    }

    /** A terminal EndNode decorated by its position set (no terminal logging). */
    function endNode(set: number[], own: OwnResult): EndNode {
      const u = [...new Set(set)].sort((a, b) => a - b)
      if (u.length === 1) {
        const p = u[0]
        if (p === 1) return { type: 'end', place: '1st', zone: 'good', set: u, opponents: oppList(1), text: 'Wins the group.' }
        if (p === 2) return { type: 'end', place: '2nd', zone: 'good', set: u, opponents: oppList(2), text: 'Through in second.' }
        if (p === 3)
          return {
            type: 'end',
            place: '3rd',
            zone: 'mid',
            set: u,
            third: { points: ptsFor(own), gd: own === 'draw' ? tGD : undefined },
          }
        return { type: 'end', place: 'Out', zone: 'bad', set: u, text: 'Out, no lifeline.' }
      }
      // 3rd-or-out decided on goal difference: keep the live 3rd visible.
      if (u.includes(3) && u.every((p) => p >= 3))
        return { type: 'end', place: placeLabel(u), zone: zoneOf(u), set: u, text: 'Third or out, decided on goal difference.' }
      // Ambiguous range that still includes a top-2 spot but isn't a clean 2-set
      // GD battle (rare 3-way ties): present as a non-interactive range.
      return { type: 'end', place: placeLabel(u), zone: zoneOf(u), set: u, text: 'Several places still open, decided on goal difference.' }
    }

    function gdBattle(set: number[], scen: Scenario, own: OwnResult, pars: SimOutcome[]): Node {
      const better = set[0]
      const worse = set[1]
      const rival = teams.find((t) => t !== team && eqSet(sortSet(scen.positions.get(t)!), set))
      if (!rival) {
        return leaf(set, own, pars) // no identifiable partner → fall back to a range leaf
      }
      const rGD = gdByTeam.get(rival) ?? 0
      const rivalIsOpponent = rival === rem.opponent
      // The rival's own result in this scenario.
      let rivalResult: OwnResult
      if (rivalIsOpponent) {
        rivalResult = own === 'win' ? 'lose' : own === 'lose' ? 'win' : 'draw'
      } else {
        const po = scen.outcomes[parIdx]
        const rivalIsParHome = rival === parHome
        rivalResult = po === 'D' ? 'draw' : (po === 'H') === rivalIsParHome ? 'win' : 'lose'
      }
      const bothWinDistinct = own === 'win' && !rivalIsOpponent && rivalResult === 'win'

      if (bothWinDistinct) {
        terminals.push({ own, pars, set })
        const gap = tGD - rGD
        const lead =
          gap > 0 ? `${team} start +${gap} ahead` : gap < 0 ? `${team} start ${-gap} behind` : `${team} and ${rival} start level`
        return {
          type: 'margins',
          note: `Goal difference decides. ${lead} (${fmt(tGD)} vs ${fmt(rGD)}).`,
          self: { team, gd: tGD },
          rival: { team: rival, gd: rGD },
          set,
          win: endNode([better], own),
          lose: endNode([worse], own),
        }
      }

      // Deterministic: at least one side's margin is fixed (a draw or a loss), so
      // the goal-difference order does not depend on a margin the user can set.
      const swing = (r: OwnResult) => (r === 'win' ? 1 : 0) // wins here take their minimum decisive margin
      const tFinal = tGD + swing(own)
      const rFinal = rGD + swing(rivalResult)
      const place = tFinal > rFinal ? better : worse
      terminals.push({ own, pars, set })
      return {
        type: 'gdnote',
        self: { team, gd: tFinal },
        rival: { team: rival, gd: rFinal },
        set,
        result: endNode([place], own),
      }
    }

    function resolve(set: number[], scen: Scenario, own: OwnResult, pars: SimOutcome[]): { node: Node; set: number[] } {
      const u = [...new Set(set)].sort((a, b) => a - b)
      // Any adjacent two-place tie is a goal-difference battle, including 3rd vs
      // 4th: e.g. two teams that drew each other (GD unchanged) settle it on GD.
      if (u.length === 2 && u[1] === u[0] + 1) {
        return { node: gdBattle(u, scen, own, pars), set: u }
      }
      return { node: leaf(u, own, pars), set: u }
    }

    function buildBranch(own: OwnResult): { node: Node; set: number[] } {
      const branches = scenarios
        .filter((s) => s.outcomes[ownIdx] === ownSim(own))
        .map((s) => ({ par: s.outcomes[parIdx] as SimOutcome, set: sortSet(s.positions.get(team)!), s }))

      const distinct = new Set(branches.map((b) => b.set.join(',')))
      if (distinct.size === 1) {
        return resolve(branches[0].set, branches[0].s, own, ['H', 'D', 'A'])
      }

      // Parallel match matters: group its outcomes by the resulting set.
      const byKey = new Map<string, { set: number[]; outs: SimOutcome[]; rep: Scenario }>()
      for (const b of branches) {
        const k = b.set.join(',')
        const g = byKey.get(k)
        if (g) g.outs.push(b.par)
        else byKey.set(k, { set: b.set, outs: [b.par], rep: b.s })
      }

      const options: Opt[] = [...byKey.values()]
        .map((g) => {
          const { node } = resolve(g.set, g.rep, own, g.outs)
          const ds = displaySet(node)
          return {
            label: parallelLabel(g.outs, parHome, parAway),
            place: placeLabel(ds),
            zone: zoneOf(ds),
            child: node,
          }
        })
        .sort((a, b) => ZONE_RANK[a.zone] - ZONE_RANK[b.zone])

      // Root for the team whose win lands the better zone.
      const setForWin = (side: 'H' | 'A') => branches.find((b) => b.par === side)?.set ?? []
      const rootFor =
        ZONE_RANK[zoneOf(setForWin('H'))] <= ZONE_RANK[zoneOf(setForWin('A'))] ? parHome : parAway

      const union = [...new Set(branches.flatMap((b) => b.set))].sort((a, b) => a - b)
      return {
        node: { type: 'choice', kind: 'parallel', home: parHome, away: parAway, rootFor, options },
        set: union,
      }
    }

    // Build the three own-result branches and simplify (drop redundant parallels).
    const built = (['win', 'draw', 'lose'] as OwnResult[]).map((r) => ({ r, node: simplify(buildBranch(r).node) }))

    // Merge own-result branches with the same outcome. Branches that land on the
    // same definite place merge across results — "Draw or lose -> 2nd" — and
    // collapse to one clean leaf. A still-open range only merges when the whole
    // sub-tree is structurally identical (so distinct drill-downs stay distinct).
    const keyOf = (b: { r: OwnResult; node: Node }) => {
      const ds = displaySet(b.node)
      if (ds.length === 1) return ds[0] === 3 ? `p3:${ptsFor(b.r)}` : `p:${ds[0]}`
      return `s:${skeleton(b.node)}`
    }
    const merged = new Map<string, { results: OwnResult[]; node: Node; place: number | null }>()
    for (const b of built) {
      const ds = displaySet(b.node)
      const g = merged.get(keyOf(b))
      if (g) g.results.push(b.r)
      else merged.set(keyOf(b), { results: [b.r], node: b.node, place: ds.length === 1 ? ds[0] : null })
    }

    const options: Opt[] = [...merged.values()]
      .map((g) => {
        // Several results on one definite place collapse to a single leaf.
        const node = g.results.length > 1 && g.place != null ? endNode([g.place], g.results[0]) : g.node
        const ds = displaySet(node)
        return {
          label: ownLabel(g.results),
          place: placeLabel(ds),
          zone: zoneOf(ds),
          child: node,
        }
      })
      .sort((a, b) => ZONE_RANK[a.zone] - ZONE_RANK[b.zone])

    const root: ChoiceNode = {
      type: 'choice',
      kind: 'own',
      home: ownFx.home,
      away: ownFx.away,
      options,
    }

    assertPaths(team, ownIdx, parIdx, ownSim, scenarios, terminals)
    return root
  }
}

/**
 * Structural key for merging own-result branches. Ignores prose (`text`/`note`)
 * and the raw position `set` (kept only for the assertion), so branches that
 * present identically — e.g. two "Out" leaves with sets {4} and {3,4} — merge
 * into one option ("Draw or lose").
 */
function skeleton(node: Node): string {
  return JSON.stringify(node, (key, value) => (key === 'text' || key === 'note' || key === 'set' ? undefined : value))
}

/** Dev-only: every enumerated scenario must map to a terminal with the engine's set. */
function assertPaths(
  team: string,
  ownIdx: number,
  parIdx: number,
  ownSim: (r: OwnResult) => SimOutcome,
  scenarios: Scenario[],
  terminals: { own: OwnResult; pars: SimOutcome[]; set: number[] }[],
): void {
  if (!import.meta.env.DEV) return
  const ownOf = (o: SimOutcome): OwnResult => (['win', 'draw', 'lose'] as OwnResult[]).find((r) => ownSim(r) === o)!
  for (const s of scenarios) {
    const own = ownOf(s.outcomes[ownIdx] as SimOutcome)
    const par = s.outcomes[parIdx] as SimOutcome
    const hit = terminals.find((t) => t.own === own && t.pars.includes(par))
    const engine = sortSet(s.positions.get(team)!)
    if (!hit) {
      console.error(`[scenarioTree] ${team}: no terminal for own=${own} par=${par} (engine ${engine.join('/')})`)
    } else if (!eqSet(hit.set, engine)) {
      console.error(`[scenarioTree] ${team}: own=${own} par=${par} baked ${hit.set.join('/')} != engine ${engine.join('/')}`)
    }
  }
}
