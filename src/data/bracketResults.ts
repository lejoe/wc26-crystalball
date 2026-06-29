/**
 * Real knockout results, keyed by matchId (73–104).
 * `hs` = score of the team in slot **a**, `as` = score of the team in slot **b**
 * (oriented to the bracket slots, not raw home/away). A real result supersedes
 * the user's path-based pick for that match in `resolveBracket`. Empty until the
 * knockout stage starts. Mirrors the group-stage real-over-prediction priority.
 *
 * `hs`/`as` hold the score after extra time (ET goals included). A knockout can't
 * end level, so for a shootout the 120' score is the (level) `hs`/`as` and `pens`
 * records the shootout, slot-oriented the same way (`pens.a` = slot a's shootout
 * score). Set `aet: true` when the match reached extra time (penalties imply it).
 * The advancing side is derived (see `resolveBracket`), never hand-picked.
 *   - Regulation: `{ hs: 1, as: 0 }`
 *   - Decided in ET: `{ hs: 3, as: 2, aet: true }`
 *   - Shootout: `{ hs: 2, as: 2, aet: true, pens: { a: 4, b: 3 } }`
 */
export type BracketResult = {
  hs: number
  as: number
  aet?: boolean
  pens?: { a: number; b: number }
}

export const BRACKET_RESULTS: Record<number, BracketResult> = {}
