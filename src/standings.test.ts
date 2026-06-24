import { describe, expect, it } from 'vitest'
import { gdOf, minThirdFromBase, minThirdPlacePoints, pointsOf, rankGroup } from './standings'
import { GROUP_LETTERS } from './data/groups'
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

describe('minThirdFromBase', () => {
  it('returns the 3rd-highest total when nothing is open (settled)', () => {
    expect(minThirdFromBase([9, 6, 3, 0], [])).toBe(3)
    expect(minThirdFromBase([4, 4, 4, 1], [])).toBe(4)
  })

  it('takes the 3rd-highest from the worst scenario across open matches', () => {
    // Two level contenders (idx 1 & 2) still play each other; the other two fixed.
    // home win -> [6,6,3,1] -> 3rd-highest 3
    // away win -> [6,3,6,1] -> 3
    // draw     -> [6,4,4,1] -> 4   (the confrontation lifts the floor in this branch)
    // MIN over scenarios = 3
    expect(minThirdFromBase([6, 3, 3, 1], [[1, 2]])).toBe(3)
  })

  it('is the minimum over every open-match combination, not the current 3rd', () => {
    // All four level, one remaining match between idx 2 & 3.
    // win 2 -> [3,3,3,0] -> 3 ; win 3 -> [3,3,0,3] -> 3 ; draw -> [3,3,1,1] -> 1
    // MIN = 1 (a draw drops the 3rd-highest below the current level)
    expect(minThirdFromBase([3, 3, 0, 0], [[2, 3]])).toBe(1)
  })

  it('handles an all-open group: round-robin floors the 3rd-highest at 1', () => {
    // Full 6-match round robin from scratch. Three teams cannot all reach 0 (they
    // play each other), but two can be held to 1 (draw each other, lose to the top
    // two), giving a 3rd-highest of 1 — the true floor.
    const allOpen: [number, number][] = [
      [0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2],
    ]
    expect(minThirdFromBase([0, 0, 0, 0], allOpen)).toBe(1)
  })

  it('depends only on the points multiset, not team order or which team is 3rd', () => {
    expect(minThirdFromBase([5, 3, 3, 3], [])).toBe(3)
    expect(minThirdFromBase([3, 5, 3, 3], [])).toBe(3)
    expect(minThirdFromBase([3, 3, 3, 5], [])).toBe(3)
  })
})

describe('minThirdPlacePoints', () => {
  it('returns a sensible non-negative number for every group', () => {
    for (const g of GROUP_LETTERS) {
      const min = minThirdPlacePoints(g)
      expect(Number.isFinite(min)).toBe(true)
      expect(min).toBeGreaterThanOrEqual(0)
    }
  })
})
