import { describe, expect, it } from 'vitest'
import { minThirdFromBase, minThirdPlacePoints } from './standings'
import { GROUP_LETTERS } from './data/groups'

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
