import { MATCHES } from './data/bracket'
import { BRACKET_RESULTS } from './data/bracketResults'
import { GROUP_LETTERS } from './data/groups'
import {
  rankGroup,
  rankThirdPlace,
  hasData,
  pointsOf,
  groupStandings,
  groupComplete,
  incompleteGoalsTeams,
  type RankedRow,
  type ThirdPlaceRow,
} from './standings'
import { effectiveH2H } from './h2h'
import { possibleGroupPositions } from './scenarios'
import type { AppState, GroupLetter, MatchDef, Side, SlotSource } from './types'

export type SlotView = {
  team: string | null // resolved qualifier, when known
  certain: boolean // true when standings/bracket fully determine it
  candidates: string[] // potential teams when not yet known
  label: string // short source label, e.g. "1st A", "Winner M74", "3rd ABCDF"
}

export type MatchView = {
  def: MatchDef
  a: SlotView
  b: SlotView
  /** Which side the user picked to advance (path-based; may carry a `?` team). */
  winnerSide: Side | null
}

type GroupCtx = {
  ranked: RankedRow[]
  complete: boolean
  hasData: boolean
  /** position → reachable teams, from scenario analysis; null when complete/empty */
  candidates: Map<number, string[]> | null
}

function slotLabel(src: SlotSource): string {
  switch (src.kind) {
    case 'pos':
      return `${src.pos === 1 ? '1st' : '2nd'} ${src.group}`
    case 'third':
      return `3rd ${src.groups.join('/')}`
    case 'winner':
      return `Winner M${src.match}`
    case 'loser':
      return `Loser M${src.match}`
  }
}

/** The eight R32 third-place slots with their FIFA-allowed source groups. */
const THIRD_SLOT_DEFS = MATCHES.flatMap((m) =>
  [m.a, m.b].filter((s): s is Extract<SlotSource, { kind: 'third' }> => s.kind === 'third'),
).map((s) => ({ slot: s.slot, groups: s.groups }))

/**
 * Assign the 8 best third-placed teams to the 8 R32 third-place slots,
 * respecting each slot's FIFA-allowed groups (bipartite perfect matching).
 * Returns {} when fewer than 8 thirds are known or no valid assignment exists.
 */
function assignThirds(thirdRanked: ThirdPlaceRow[]): Record<string, string> {
  const top8 = thirdRanked.slice(0, 8)
  if (top8.length < 8) return {}

  const slots = THIRD_SLOT_DEFS
  const teams = top8.map((t) => ({ team: t.standing.team, group: t.group }))
  const matchTeam = new Array<number>(teams.length).fill(-1) // teamIdx -> slotIdx

  const tryAssign = (si: number, seen: boolean[]): boolean => {
    for (let ti = 0; ti < teams.length; ti++) {
      if (!slots[si].groups.includes(teams[ti].group) || seen[ti]) continue
      seen[ti] = true
      if (matchTeam[ti] === -1 || tryAssign(matchTeam[ti], seen)) {
        matchTeam[ti] = si
        return true
      }
    }
    return false
  }

  for (let si = 0; si < slots.length; si++) {
    if (!tryAssign(si, new Array(teams.length).fill(false))) return {} // no perfect matching
  }

  const out: Record<string, string> = {}
  for (let ti = 0; ti < teams.length; ti++) {
    if (matchTeam[ti] !== -1) out[slots[matchTeam[ti]].slot] = teams[ti].team
  }
  return out
}

function groupSlot(src: Extract<SlotSource, { kind: 'pos' }>, ctx: GroupCtx): SlotView {
  const label = slotLabel(src)
  if (!ctx.hasData) return { team: null, certain: false, candidates: [], label }

  if (ctx.complete) {
    const row = ctx.ranked.find((r) => r.position === src.pos)!
    if (!row.unresolved && !row.needsScores) {
      return { team: row.standing.team, certain: true, candidates: [], label }
    }
    // Complete group whose order at this spot isn't settled (needs an exact
    // score, or genuinely tied) → show the level teams as candidates.
    const p = pointsOf(row.standing)
    const cluster = ctx.ranked.filter((r) => pointsOf(r.standing) === p).map((r) => r.standing.team)
    return { team: null, certain: false, candidates: cluster, label }
  }

  // In progress: candidates that can still reach this position.
  const list = ctx.candidates?.get(src.pos) ?? []
  if (list.length === 1) return { team: list[0], certain: true, candidates: [], label }
  return { team: null, certain: false, candidates: list, label }
}

function thirdSlot(
  src: Extract<SlotSource, { kind: 'third' }>,
  ctxByGroup: Record<GroupLetter, GroupCtx>,
  assignment: Record<string, string>,
  allGroupsComplete: boolean,
): SlotView {
  const label = slotLabel(src)
  if (allGroupsComplete) {
    const team = assignment[src.slot] ?? null
    return { team, certain: !!team, candidates: [], label }
  }
  // Potential third-placed teams from each allowed group.
  const set = new Set<string>()
  for (const g of src.groups) {
    const ctx = ctxByGroup[g]
    if (!ctx.hasData) continue
    if (ctx.complete) {
      const row = ctx.ranked.find((r) => r.position === 3)
      if (row) set.add(row.standing.team)
    } else {
      for (const t of ctx.candidates?.get(3) ?? []) set.add(t)
    }
  }
  return { team: null, certain: false, candidates: [...set], label }
}

/**
 * Resolve every match: who fills each slot, and the advancing side.
 *
 * Picks are path-based: stored by side ('a'/'b'), never by team. A pick rides
 * along when the slot's team changes and is never validated or cleared against
 * the current participants. When a real result exists in `BRACKET_RESULTS`, it
 * supersedes the stored pick for that match — both for the rendered winner and
 * for downstream slot filling — mirroring the group-stage real-over-prediction
 * priority. The pick stays stored, just unused for that match.
 */
export function resolveBracket(state: AppState): Record<number, MatchView> {
  const { predictions, predScores } = state
  const h2h = effectiveH2H(predictions, predScores)
  const groups = {} as Record<GroupLetter, ReturnType<typeof groupStandings>>
  const ctx = {} as Record<GroupLetter, GroupCtx>
  let allGroupsComplete = true
  for (const g of GROUP_LETTERS) {
    const standings = groupStandings(g, predictions, predScores)
    groups[g] = standings
    const ranked = rankGroup(standings, h2h, incompleteGoalsTeams(g, predictions, predScores))
    const groupHasData = ranked.some((r) => hasData(r.standing))
    const complete = groupComplete(g, predictions, predScores)
    if (!complete) allGroupsComplete = false
    ctx[g] = {
      ranked,
      complete,
      hasData: groupHasData,
      candidates: complete || !groupHasData ? null : possibleGroupPositions(g, predictions, predScores).candidates,
    }
  }
  const thirdRanked = rankThirdPlace(groups, h2h)
  const assignment = assignThirds(thirdRanked)

  const views: Record<number, MatchView> = {}

  // The side that advances from a match (or null), and the side that loses.
  const advancing = (m: MatchView | undefined): SlotView | null =>
    m && m.winnerSide ? (m.winnerSide === 'a' ? m.a : m.b) : null
  const losing = (m: MatchView | undefined): SlotView | null =>
    m && m.winnerSide ? (m.winnerSide === 'a' ? m.b : m.a) : null

  const slotView = (src: SlotSource): SlotView => {
    switch (src.kind) {
      case 'pos':
        return groupSlot(src, ctx[src.group])
      case 'third':
        return thirdSlot(src, ctx, assignment, allGroupsComplete)
      case 'winner': {
        const adv = advancing(views[src.match])
        return adv
          ? { team: adv.team, certain: !!adv.team, candidates: adv.candidates, label: slotLabel(src) }
          : { team: null, certain: false, candidates: [], label: slotLabel(src) }
      }
      case 'loser': {
        const los = losing(views[src.match])
        return los
          ? { team: los.team, certain: !!los.team, candidates: los.candidates, label: slotLabel(src) }
          : { team: null, certain: false, candidates: [], label: slotLabel(src) }
      }
    }
  }

  // MATCHES is ordered by id, so winner/loser sources are resolved first.
  for (const def of MATCHES) {
    const a = slotView(def.a)
    const b = slotView(def.b)
    const stored = state.bracketPredictions[def.id]
    const pick: Side | null = stored === 'a' || stored === 'b' ? stored : null
    const real = BRACKET_RESULTS[def.id]
    const realSide: Side | null = real ? (real.hs > real.as ? 'a' : 'b') : null
    const winnerSide = realSide ?? pick
    views[def.id] = { def, a, b, winnerSide }
  }

  return views
}
