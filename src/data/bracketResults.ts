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

export const BRACKET_RESULTS: Record<number, BracketResult> = {
  // R32 #73 — South Africa (A2, slot a) 0–1 Canada (B2, slot b)
  73: { hs: 0, as: 1 },
  // R32 #74 — Germany (E1, slot a) 1–1 Paraguay (T74/D3, slot b), Paraguay win 4–3 on pens
  74: { hs: 1, as: 1, aet: true, pens: { a: 3, b: 4 } },
  // R32 #75 — Netherlands (F1, slot a) 1–1 Morocco (C2, slot b), Morocco win 3–2 on pens
  75: { hs: 1, as: 1, aet: true, pens: { a: 2, b: 3 } },
  // R32 #76 — Brazil (C1, slot a) 2–1 Japan (F2, slot b)
  76: { hs: 2, as: 1 },
}
