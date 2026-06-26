import type { GroupLetter, MatchDef } from '../types'

/**
 * Official FIFA World Cup 2026 knockout bracket.
 * Source: 2026 FIFA World Cup knockout stage (Wikipedia / FIFA regulations).
 * The eight third-place slots each carry the set of groups they may draw from.
 */
export const MATCHES: MatchDef[] = [
  // Round of 32
  { id: 73, round: 'R32', a: { kind: 'pos', pos: 2, group: 'A' }, b: { kind: 'pos', pos: 2, group: 'B' }, kickoff: '2026-06-28T12:00:00-07:00' },
  { id: 74, round: 'R32', a: { kind: 'pos', pos: 1, group: 'E' }, b: third('T74', ['A', 'B', 'C', 'D', 'F']), kickoff: '2026-06-29T16:30:00-04:00' },
  { id: 75, round: 'R32', a: { kind: 'pos', pos: 1, group: 'F' }, b: { kind: 'pos', pos: 2, group: 'C' }, kickoff: '2026-06-29T19:00:00-06:00' },
  { id: 76, round: 'R32', a: { kind: 'pos', pos: 1, group: 'C' }, b: { kind: 'pos', pos: 2, group: 'F' }, kickoff: '2026-06-29T12:00:00-05:00' },
  { id: 77, round: 'R32', a: { kind: 'pos', pos: 1, group: 'I' }, b: third('T77', ['C', 'D', 'F', 'G', 'H']), kickoff: '2026-06-30T17:00:00-04:00' },
  { id: 78, round: 'R32', a: { kind: 'pos', pos: 2, group: 'E' }, b: { kind: 'pos', pos: 2, group: 'I' }, kickoff: '2026-06-30T12:00:00-05:00' },
  { id: 79, round: 'R32', a: { kind: 'pos', pos: 1, group: 'A' }, b: third('T79', ['C', 'E', 'F', 'H', 'I']), kickoff: '2026-06-30T19:00:00-06:00' },
  { id: 80, round: 'R32', a: { kind: 'pos', pos: 1, group: 'L' }, b: third('T80', ['E', 'H', 'I', 'J', 'K']), kickoff: '2026-07-01T12:00:00-04:00' },
  { id: 81, round: 'R32', a: { kind: 'pos', pos: 1, group: 'D' }, b: third('T81', ['B', 'E', 'F', 'I', 'J']), kickoff: '2026-07-01T17:00:00-07:00' },
  { id: 82, round: 'R32', a: { kind: 'pos', pos: 1, group: 'G' }, b: third('T82', ['A', 'E', 'H', 'I', 'J']), kickoff: '2026-07-01T13:00:00-07:00' },
  { id: 83, round: 'R32', a: { kind: 'pos', pos: 2, group: 'K' }, b: { kind: 'pos', pos: 2, group: 'L' }, kickoff: '2026-07-02T19:00:00-04:00' },
  { id: 84, round: 'R32', a: { kind: 'pos', pos: 1, group: 'H' }, b: { kind: 'pos', pos: 2, group: 'J' }, kickoff: '2026-07-02T12:00:00-07:00' },
  { id: 85, round: 'R32', a: { kind: 'pos', pos: 1, group: 'B' }, b: third('T85', ['E', 'F', 'G', 'I', 'J']), kickoff: '2026-07-02T20:00:00-07:00' },
  { id: 86, round: 'R32', a: { kind: 'pos', pos: 1, group: 'J' }, b: { kind: 'pos', pos: 2, group: 'H' }, kickoff: '2026-07-03T18:00:00-04:00' },
  { id: 87, round: 'R32', a: { kind: 'pos', pos: 1, group: 'K' }, b: third('T87', ['D', 'E', 'I', 'J', 'L']), kickoff: '2026-07-03T20:30:00-05:00' },
  { id: 88, round: 'R32', a: { kind: 'pos', pos: 2, group: 'D' }, b: { kind: 'pos', pos: 2, group: 'G' }, kickoff: '2026-07-03T13:00:00-05:00' },

  // Round of 16
  { id: 89, round: 'R16', a: { kind: 'winner', match: 74 }, b: { kind: 'winner', match: 77 }, kickoff: '2026-07-04T17:00:00-04:00' },
  { id: 90, round: 'R16', a: { kind: 'winner', match: 73 }, b: { kind: 'winner', match: 75 }, kickoff: '2026-07-04T12:00:00-05:00' },
  { id: 91, round: 'R16', a: { kind: 'winner', match: 76 }, b: { kind: 'winner', match: 78 }, kickoff: '2026-07-05T16:00:00-04:00' },
  { id: 92, round: 'R16', a: { kind: 'winner', match: 79 }, b: { kind: 'winner', match: 80 }, kickoff: '2026-07-05T18:00:00-06:00' },
  { id: 93, round: 'R16', a: { kind: 'winner', match: 83 }, b: { kind: 'winner', match: 84 }, kickoff: '2026-07-06T14:00:00-05:00' },
  { id: 94, round: 'R16', a: { kind: 'winner', match: 81 }, b: { kind: 'winner', match: 82 }, kickoff: '2026-07-06T17:00:00-07:00' },
  { id: 95, round: 'R16', a: { kind: 'winner', match: 86 }, b: { kind: 'winner', match: 88 }, kickoff: '2026-07-07T12:00:00-04:00' },
  { id: 96, round: 'R16', a: { kind: 'winner', match: 85 }, b: { kind: 'winner', match: 87 }, kickoff: '2026-07-07T13:00:00-07:00' },

  // Quarter-finals
  { id: 97, round: 'QF', a: { kind: 'winner', match: 89 }, b: { kind: 'winner', match: 90 }, kickoff: '2026-07-09T16:00:00-04:00' },
  { id: 98, round: 'QF', a: { kind: 'winner', match: 93 }, b: { kind: 'winner', match: 94 }, kickoff: '2026-07-10T12:00:00-07:00' },
  { id: 99, round: 'QF', a: { kind: 'winner', match: 91 }, b: { kind: 'winner', match: 92 }, kickoff: '2026-07-11T17:00:00-04:00' },
  { id: 100, round: 'QF', a: { kind: 'winner', match: 95 }, b: { kind: 'winner', match: 96 }, kickoff: '2026-07-11T20:00:00-05:00' },

  // Semi-finals
  { id: 101, round: 'SF', a: { kind: 'winner', match: 97 }, b: { kind: 'winner', match: 98 }, kickoff: '2026-07-14T14:00:00-05:00' },
  { id: 102, round: 'SF', a: { kind: 'winner', match: 99 }, b: { kind: 'winner', match: 100 }, kickoff: '2026-07-15T15:00:00-04:00' },

  // Third-place play-off & Final
  { id: 103, round: '3P', a: { kind: 'loser', match: 101 }, b: { kind: 'loser', match: 102 }, kickoff: '2026-07-18T17:00:00-04:00' },
  { id: 104, round: 'F', a: { kind: 'winner', match: 101 }, b: { kind: 'winner', match: 102 }, kickoff: '2026-07-19T15:00:00-04:00' },
]

function third(slot: string, groups: GroupLetter[]) {
  return { kind: 'third' as const, slot, groups }
}

export const MATCH_BY_ID: Record<number, MatchDef> = Object.fromEntries(
  MATCHES.map((m) => [m.id, m]),
)
