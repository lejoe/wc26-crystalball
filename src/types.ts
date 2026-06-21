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
