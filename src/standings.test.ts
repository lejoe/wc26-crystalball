import { describe, expect, it } from 'vitest'
import { thirdPlaceContenders, type IncompleteGoals } from './standings'
import type { H2HRecord, TeamStanding } from './types'

/** Build a standing with the given points (via W/D) and goal difference. */
function team(
  name: string,
  pts: number,
  gd: number,
  opts: { gf?: number; played?: number } = {},
): TeamStanding {
  const won = Math.floor(pts / 3)
  const drawn = pts % 3
  const played = opts.played ?? won + drawn + 1
  const goalsFor = opts.gf ?? Math.max(gd, 0) + 1
  return {
    team: name,
    played,
    won,
    drawn,
    lost: played - won - drawn,
    goalsFor,
    goalsAgainst: goalsFor - gd,
  }
}

/** A drawn head-to-head between two teams (level on h2h points, gd, gf). */
function drawH2H(a: string, b: string): H2HRecord {
  return { teamA: a, teamB: b, pointsA: 1, gdA: 0, goalsA: 1 }
}

/** A → B head-to-head win (separates them on h2h points). */
function winH2H(a: string, b: string): H2HRecord {
  return { teamA: a, teamB: b, pointsA: 3, gdA: 1, goalsA: 1 }
}

function pending(...teams: string[]): IncompleteGoals {
  const m: IncompleteGoals = new Map()
  for (const t of teams) m.set(t, { draw: false, decisive: true })
  return m
}

describe('thirdPlaceContenders', () => {
  it('excludes a same-points team that is locked above third by goal difference', () => {
    // Mirrors the real Group B bug: a +6 side level on points with the third
    // team (and level head-to-head) was wrongly listed as a third contender.
    const standings = [
      team('Leader', 7, 4),
      team('BigGD', 4, 6), // like Canada: huge goal difference, can't be third
      team('Third', 4, -3), // like Bosnia: the actual third-placed team
      team('Bottom', 1, -7),
    ]
    const h2h = [drawH2H('BigGD', 'Third')]
    // Both have an outcome-only predicted match still pending (no exact score).
    const incomplete = pending('BigGD', 'Third')

    expect(thirdPlaceContenders(standings, h2h, incomplete)).toEqual(['Third'])
  })

  it('lists every team in a genuine goal-difference tie', () => {
    const standings = [
      team('Leader', 7, 4),
      team('TieA', 4, 0, { gf: 3 }),
      team('TieB', 4, 0, { gf: 3 }),
      team('Bottom', 1, -7),
    ]
    const h2h = [drawH2H('TieA', 'TieB')]
    const incomplete = pending('TieA', 'TieB')

    expect(thirdPlaceContenders(standings, h2h, incomplete).sort()).toEqual(['TieA', 'TieB'])
  })

  it('excludes a same-points team separated by head-to-head', () => {
    const standings = [
      team('Leader', 7, 4),
      team('H2HWinner', 4, 0, { gf: 3 }),
      team('Third', 4, 0, { gf: 3 }),
      team('Bottom', 1, -7),
    ]
    // Same points and same goal difference, but H2HWinner beat Third.
    const h2h = [winH2H('H2HWinner', 'Third')]
    const incomplete = pending('H2HWinner', 'Third')

    expect(thirdPlaceContenders(standings, h2h, incomplete)).toEqual(['Third'])
  })

  it('returns a single team when third place is uniquely decided', () => {
    const standings = [
      team('Leader', 7, 4),
      team('Second', 6, 2),
      team('Third', 3, -1),
      team('Bottom', 1, -7),
    ]
    expect(thirdPlaceContenders(standings, [])).toEqual(['Third'])
  })

  it('resolves a goal-difference-level pair once exact scores separate goals-for', () => {
    // No pending matches (all scores known); goal difference level but goals-for
    // differs, so the order is decided and only the third team remains.
    const standings = [
      team('Leader', 7, 4),
      team('Higher', 4, 0, { gf: 5 }),
      team('Third', 4, 0, { gf: 2 }),
      team('Bottom', 1, -7),
    ]
    const h2h = [drawH2H('Higher', 'Third')]
    expect(thirdPlaceContenders(standings, h2h)).toEqual(['Third'])
  })
})
