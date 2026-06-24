import { describe, expect, it } from 'vitest'
import { gdOf, pointsOf, rankGroup } from './standings'
import type { H2HRecord, TeamStanding } from './types'

const st = (team: string, w: number, d: number, l: number, gf: number, ga: number): TeamStanding => ({
  team,
  played: w + d + l,
  won: w,
  drawn: d,
  lost: l,
  goalsFor: gf,
  goalsAgainst: ga,
})

/** A head-to-head record for the A-vs-B match (points/gd/goals from A's view). */
const h2h = (teamA: string, teamB: string, pointsA: number, gdA = 0, goalsA = 0): H2HRecord => ({
  teamA,
  teamB,
  pointsA,
  gdA,
  goalsA,
})

const order = (rows: ReturnType<typeof rankGroup>) => rows.map((r) => r.standing.team)

describe('pointsOf / gdOf', () => {
  it('counts 3 per win, 1 per draw', () => {
    expect(pointsOf(st('X', 2, 1, 0, 0, 0))).toBe(7)
    expect(pointsOf(st('X', 0, 0, 3, 0, 0))).toBe(0)
  })
  it('goal difference is for minus against', () => {
    expect(gdOf(st('X', 0, 0, 0, 5, 2))).toBe(3)
    expect(gdOf(st('X', 0, 0, 0, 1, 4))).toBe(-3)
  })
})

describe('rankGroup tiebreaker cascade', () => {
  it('orders by points first', () => {
    // A 9 pts, B 4 pts, D 1 pt, C 0 pts.
    const ranked = rankGroup(
      [st('C', 0, 0, 2, 0, 5), st('A', 3, 0, 0, 9, 0), st('B', 1, 1, 1, 4, 4), st('D', 0, 1, 2, 1, 6)],
      [],
    )
    expect(order(ranked)).toEqual(['A', 'B', 'D', 'C'])
    expect(ranked.map((r) => r.position)).toEqual([1, 2, 3, 4])
  })

  it('breaks a points tie on head-to-head points (step 1)', () => {
    // Both on 3 points with identical overall GD/GF; only H2H separates them.
    const ranked = rankGroup([st('A', 1, 0, 1, 2, 2), st('B', 1, 0, 1, 2, 2)], [h2h('A', 'B', 3, 1, 1)])
    expect(order(ranked)).toEqual(['A', 'B'])
  })

  it('falls to overall goal difference when the head-to-head is level (step 4)', () => {
    // Both 4 pts, drew each other (H2H equal) -> overall GD decides. A +3 beats B +1.
    const ranked = rankGroup([st('B', 1, 1, 0, 3, 2), st('A', 1, 1, 0, 5, 2)], [h2h('A', 'B', 1, 0, 1)])
    expect(order(ranked)).toEqual(['A', 'B'])
  })

  it('flags an unbreakable tie as unresolved', () => {
    // Identical points, H2H draw, identical GD and GF -> genuinely inseparable.
    const ranked = rankGroup([st('A', 1, 1, 0, 3, 2), st('B', 1, 1, 0, 3, 2)], [h2h('A', 'B', 1, 0, 1)])
    expect(ranked.every((r) => r.unresolved)).toBe(true)
    expect(ranked.every((r) => r.needsScores)).toBe(false)
  })

  it('flags needsScores when a tied team has incomplete goal data', () => {
    const ranked = rankGroup(
      [st('A', 1, 1, 0, 3, 2), st('B', 1, 1, 0, 3, 2)],
      [h2h('A', 'B', 1, 0, 1)],
      new Map([['A', { draw: true, decisive: false }]]),
    )
    expect(ranked.every((r) => r.needsScores)).toBe(true)
    expect(ranked.every((r) => r.unresolved)).toBe(false)
  })
})
