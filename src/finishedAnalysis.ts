import { MATCHES } from './data/bracket'
import { BRACKET_RESULTS } from './data/bracketResults'
import type { MatchView } from './bracketResolve'
import type { Round } from './types'

/** What a team's post-group board shows. */
export type FinishedKind =
  | 'advanced' // 1st/2nd, or a 3rd assigned to a bracket slot → mini-bracket path
  | 'out-group' // finished 3rd/4th and eliminated in the group phase → table only
  | 'third-undecided' // finished 3rd, best-third race not yet settled → thirds ranking

export type FinishedView = {
  kind: FinishedKind
  /** Final group position (1-based). */
  position: number
  /** True once a real knockout result eliminated the team. */
  knockedOut: boolean
  /** Round the team's current (alive) or elimination match sits in; null when no path. */
  anchorRound: Round | null
  /** Ordered path columns (one match each) for the mini-bracket; empty unless `advanced`. */
  path: MatchView[]
}

// Knockout rounds in progression order; the third-place play-off is off the path.
const ROUND_ORDER: Round[] = ['R32', 'R16', 'QF', 'SF', 'F']
const roundRank = (r: Round) => ROUND_ORDER.indexOf(r)

// Forward edge: a match id → the match its winner advances into.
const NEXT_WINNER_MATCH = new Map<number, number>()
for (const m of MATCHES) {
  for (const s of [m.a, m.b]) {
    if (s.kind === 'winner') NEXT_WINNER_MATCH.set(s.match, m.id)
  }
}

const winnerSlotOf = (v: MatchView) =>
  v.winnerSide === 'a' ? v.a : v.winnerSide === 'b' ? v.b : null

/**
 * Build the post-group board for a team whose group is finished.
 *
 * Stage basis is per-team: the window width follows the round of the team's own
 * current (still alive) or elimination match — Round of 32 shows three columns,
 * any later round shows two. The anchor is found from real knockout results only
 * (predictions still fill the projected columns), so a team sits at its genuine
 * current position regardless of how the bracket is predicted downstream.
 */
export function buildFinishedView(
  team: string,
  position: number,
  views: Record<number, MatchView>,
  allGroupsComplete: boolean,
): FinishedView {
  const base = { position, knockedOut: false, anchorRound: null, path: [] as MatchView[] }

  // Matches the team actually fills a slot in (third-place play-off excluded).
  const appeared = MATCHES.filter((m) => {
    const v = views[m.id]
    return m.round !== '3P' && v && (v.a.team === team || v.b.team === team)
  })

  if (position >= 4) return { ...base, kind: 'out-group' }

  if (position === 3 && appeared.length === 0) {
    // A 3rd-placed team only gets a bracket slot once the best-third race resolves.
    return allGroupsComplete
      ? { ...base, kind: 'out-group' } // ranked outside the best 8
      : { ...base, kind: 'third-undecided' } // race still open across groups
  }

  if (appeared.length === 0) return { ...base, kind: 'advanced' } // defensive; 1st/2nd always appear

  // Walk forward from the team's first knockout match while real results confirm
  // it advanced. The match we stop on is its current (or elimination) match.
  const start = appeared.reduce((a, b) => (roundRank(b.round) < roundRank(a.round) ? b : a))
  let anchorId = start.id
  while (true) {
    const v = views[anchorId]
    if (!(anchorId in BRACKET_RESULTS)) break // not played for real yet → current match
    if (winnerSlotOf(v)?.team !== team) break // a real result eliminated the team here
    const next = NEXT_WINNER_MATCH.get(anchorId)
    const inNext = next != null && (views[next]?.a.team === team || views[next]?.b.team === team)
    if (!inNext) break // team does not (yet) fill the next match → stop here
    anchorId = next
  }

  const anchor = views[anchorId]
  const anchorRound = anchor.def.round
  const knockedOut =
    anchorId in BRACKET_RESULTS && winnerSlotOf(anchor)?.team !== team

  const width = anchorRound === 'R32' ? 3 : 2
  const path: MatchView[] = []
  let cur: number | undefined = anchorId
  for (let i = 0; i < width && cur != null && views[cur]; i++) {
    path.push(views[cur])
    cur = NEXT_WINNER_MATCH.get(cur)
  }

  return { kind: 'advanced', position, knockedOut, anchorRound, path }
}

export const ROUND_NAME: Record<Round, string> = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarter-finals',
  SF: 'Semi-finals',
  '3P': 'Third-place play-off',
  F: 'Final',
}
