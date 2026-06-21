export type GroupLetter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'

/** Result of a single group match (no score). */
export type Outcome = 'home' | 'draw' | 'away'

/** A predicted exact score for an upcoming match. */
export type PredScore = { hs: number; as: number }

/** Which side of a knockout match was picked to advance. */
export type Side = 'a' | 'b'

export type TeamStanding = {
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  /** Kept for the tiebreaker cascade; always 0 in the no-score model. */
  goalsFor: number
  goalsAgainst: number
}

export type H2HRecord = {
  teamA: string
  teamB: string
  pointsA: number // 0, 1, or 3 (points team A took from the match)
  gdA: number // goal difference from that match for A (goalsA - goalsB)
  goalsA: number // goals A scored in that match
}

export type Round = 'R32' | 'R16' | 'QF' | 'SF' | '3P' | 'F'

export type SlotSource =
  | { kind: 'pos'; pos: 1 | 2; group: GroupLetter }
  | { kind: 'third'; slot: string; groups: GroupLetter[] }
  | { kind: 'winner'; match: number }
  | { kind: 'loser'; match: number }

export type MatchDef = {
  id: number
  round: Round
  a: SlotSource
  b: SlotSource
}

/** Advancement bucket for a team, certified by points + head-to-head only. */
export type StatusTone = 'through' | 'in-balance' | 'out'

/** One per-team line in a group's at-a-glance overview. */
export type ToneLine = { team: string; tone: StatusTone; line: string }

/** The selected team's result-by-result advancement breakdown. */
export type WdlBreakdown = { result: 'win' | 'draw' | 'lose'; text: string }

/**
 * Closed vocabulary of analysis blocks the AI composes per team. The UI knows how
 * to render each type; the AI chooses which appear, in what order, and what to
 * emphasise. (The group-overview is rendered structurally from `overview`.)
 */
export type AnalysisBlock =
  | { type: 'verdict'; tone: StatusTone; text: string }
  | { type: 'advancement-scenario'; text: string; breakdown?: WdlBreakdown[] }
  | { type: 'position-scenario'; text: string }
  | { type: 'tiebreaker-note'; lever: 'h2h' | 'gd' | 'goals'; text: string }
  | { type: 'third-place-lean'; text: string; lean?: 'favourable' | 'borderline' | 'unfavourable' }
  | { type: 'elimination'; text: string }
  | { type: 'nothing-left'; text: string }

/** AI-composed analysis for one group, cached against its real-results fingerprint. */
export type GroupAnalysis = {
  group: GroupLetter
  fingerprint: string
  /** The always-shown group overview: one tone line per team, in standings order. */
  overview: ToneLine[]
  /** Per-team detail block compositions, keyed by team name. */
  teams: Record<string, AnalysisBlock[]>
}

/** The committed artifact: only ready groups are present. */
export type GroupAnalysisFile = {
  groups: Partial<Record<GroupLetter, GroupAnalysis>>
}

export type AppState = {
  /**
   * Predicted outcomes for UPCOMING matches, keyed by `${group}:${fixtureIndex}`.
   * Past matches are not stored here — their real scores come from FIXTURES.
   */
  predictions: Record<string, Outcome>
  /**
   * Predicted exact scores for upcoming matches (same key). Used when a tie
   * needs goal difference; a score here overrides the plain outcome.
   */
  predScores: Record<string, PredScore>
  /** Which side advances per knockout match (path-based, so a `?` can advance). */
  bracketPredictions: Record<number, Side>
}
