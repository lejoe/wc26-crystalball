import type { GroupLetter, MatchDef } from '../types'

/**
 * Official FIFA World Cup 2026 knockout bracket.
 * Source: 2026 FIFA World Cup knockout stage (Wikipedia / FIFA regulations).
 * The eight third-place slots each carry the set of groups they may draw from.
 */
export const MATCHES: MatchDef[] = [
  // Round of 32
  { id: 73, round: 'R32', a: { kind: 'pos', pos: 2, group: 'A' }, b: { kind: 'pos', pos: 2, group: 'B' } },
  { id: 74, round: 'R32', a: { kind: 'pos', pos: 1, group: 'E' }, b: third('T74', ['A', 'B', 'C', 'D', 'F']) },
  { id: 75, round: 'R32', a: { kind: 'pos', pos: 1, group: 'F' }, b: { kind: 'pos', pos: 2, group: 'C' } },
  { id: 76, round: 'R32', a: { kind: 'pos', pos: 1, group: 'C' }, b: { kind: 'pos', pos: 2, group: 'F' } },
  { id: 77, round: 'R32', a: { kind: 'pos', pos: 1, group: 'I' }, b: third('T77', ['C', 'D', 'F', 'G', 'H']) },
  { id: 78, round: 'R32', a: { kind: 'pos', pos: 2, group: 'E' }, b: { kind: 'pos', pos: 2, group: 'I' } },
  { id: 79, round: 'R32', a: { kind: 'pos', pos: 1, group: 'A' }, b: third('T79', ['C', 'E', 'F', 'H', 'I']) },
  { id: 80, round: 'R32', a: { kind: 'pos', pos: 1, group: 'L' }, b: third('T80', ['E', 'H', 'I', 'J', 'K']) },
  { id: 81, round: 'R32', a: { kind: 'pos', pos: 1, group: 'D' }, b: third('T81', ['B', 'E', 'F', 'I', 'J']) },
  { id: 82, round: 'R32', a: { kind: 'pos', pos: 1, group: 'G' }, b: third('T82', ['A', 'E', 'H', 'I', 'J']) },
  { id: 83, round: 'R32', a: { kind: 'pos', pos: 2, group: 'K' }, b: { kind: 'pos', pos: 2, group: 'L' } },
  { id: 84, round: 'R32', a: { kind: 'pos', pos: 1, group: 'H' }, b: { kind: 'pos', pos: 2, group: 'J' } },
  { id: 85, round: 'R32', a: { kind: 'pos', pos: 1, group: 'B' }, b: third('T85', ['E', 'F', 'G', 'I', 'J']) },
  { id: 86, round: 'R32', a: { kind: 'pos', pos: 1, group: 'J' }, b: { kind: 'pos', pos: 2, group: 'H' } },
  { id: 87, round: 'R32', a: { kind: 'pos', pos: 1, group: 'K' }, b: third('T87', ['D', 'E', 'I', 'J', 'L']) },
  { id: 88, round: 'R32', a: { kind: 'pos', pos: 2, group: 'D' }, b: { kind: 'pos', pos: 2, group: 'G' } },

  // Round of 16
  { id: 89, round: 'R16', a: { kind: 'winner', match: 74 }, b: { kind: 'winner', match: 77 } },
  { id: 90, round: 'R16', a: { kind: 'winner', match: 73 }, b: { kind: 'winner', match: 75 } },
  { id: 91, round: 'R16', a: { kind: 'winner', match: 76 }, b: { kind: 'winner', match: 78 } },
  { id: 92, round: 'R16', a: { kind: 'winner', match: 79 }, b: { kind: 'winner', match: 80 } },
  { id: 93, round: 'R16', a: { kind: 'winner', match: 83 }, b: { kind: 'winner', match: 84 } },
  { id: 94, round: 'R16', a: { kind: 'winner', match: 81 }, b: { kind: 'winner', match: 82 } },
  { id: 95, round: 'R16', a: { kind: 'winner', match: 86 }, b: { kind: 'winner', match: 88 } },
  { id: 96, round: 'R16', a: { kind: 'winner', match: 85 }, b: { kind: 'winner', match: 87 } },

  // Quarter-finals
  { id: 97, round: 'QF', a: { kind: 'winner', match: 89 }, b: { kind: 'winner', match: 90 } },
  { id: 98, round: 'QF', a: { kind: 'winner', match: 93 }, b: { kind: 'winner', match: 94 } },
  { id: 99, round: 'QF', a: { kind: 'winner', match: 91 }, b: { kind: 'winner', match: 92 } },
  { id: 100, round: 'QF', a: { kind: 'winner', match: 95 }, b: { kind: 'winner', match: 96 } },

  // Semi-finals
  { id: 101, round: 'SF', a: { kind: 'winner', match: 97 }, b: { kind: 'winner', match: 98 } },
  { id: 102, round: 'SF', a: { kind: 'winner', match: 99 }, b: { kind: 'winner', match: 100 } },

  // Third-place play-off & Final
  { id: 103, round: '3P', a: { kind: 'loser', match: 101 }, b: { kind: 'loser', match: 102 } },
  { id: 104, round: 'F', a: { kind: 'winner', match: 101 }, b: { kind: 'winner', match: 102 } },
]

function third(slot: string, groups: GroupLetter[]) {
  return { kind: 'third' as const, slot, groups }
}

export const MATCH_BY_ID: Record<number, MatchDef> = Object.fromEntries(
  MATCHES.map((m) => [m.id, m]),
)
