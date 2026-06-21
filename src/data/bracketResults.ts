/**
 * Real knockout results, keyed by matchId (73–104).
 * `hs` = score of the team in slot **a**, `as` = score of the team in slot **b**
 * (oriented to the bracket slots, not raw home/away). A real result supersedes
 * the user's path-based pick for that match in `resolveBracket`. Empty until the
 * knockout stage starts. Mirrors the group-stage real-over-prediction priority.
 */
export const BRACKET_RESULTS: Record<number, { hs: number; as: number }> = {}
