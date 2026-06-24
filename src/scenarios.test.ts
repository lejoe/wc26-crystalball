import { describe, expect, it } from 'vitest'
import { scenarioPositions } from './scenarios'

/** Build the H2H points map scenarioPositions expects: key `${winner}|${loser}`. */
const h2hMap = (entries: [string, string, number][]): Map<string, number> => {
  const m = new Map<string, number>()
  for (const [a, b, p] of entries) m.set(`${a}|${b}`, p)
  return m
}

const ptsMap = (entries: Record<string, number>) => new Map(Object.entries(entries))

const setOf = (positions: Map<string, Set<number>>, team: string) =>
  [...positions.get(team)!].sort((a, b) => a - b)

describe('scenarioPositions (points + head-to-head only)', () => {
  it('assigns a single position when points are distinct', () => {
    const pos = scenarioPositions(['A', 'B', 'C', 'D'], ptsMap({ A: 9, B: 6, C: 3, D: 0 }), new Map())
    expect(setOf(pos, 'A')).toEqual([1])
    expect(setOf(pos, 'B')).toEqual([2])
    expect(setOf(pos, 'C')).toEqual([3])
    expect(setOf(pos, 'D')).toEqual([4])
  })

  it('separates a points tie when head-to-head decides it', () => {
    // A and B level on 3; A won the head-to-head, so A is 1st and B is 2nd.
    const pos = scenarioPositions(
      ['A', 'B', 'C', 'D'],
      ptsMap({ A: 3, B: 3, C: 0, D: 0 }),
      h2hMap([
        ['A', 'B', 3],
        ['B', 'A', 0],
      ]),
    )
    expect(setOf(pos, 'A')).toEqual([1])
    expect(setOf(pos, 'B')).toEqual([2])
    // C and D are level with no head-to-head -> shared, GD-deferred range.
    expect(setOf(pos, 'C')).toEqual([3, 4])
    expect(setOf(pos, 'D')).toEqual([3, 4])
  })

  it('leaves a points + head-to-head tie ambiguous (goal difference deferred)', () => {
    // A and B drew (equal H2H points) -> both can be 1st or 2nd; GD is not used here.
    const pos = scenarioPositions(
      ['A', 'B', 'C'],
      ptsMap({ A: 3, B: 3, C: 0 }),
      h2hMap([
        ['A', 'B', 1],
        ['B', 'A', 1],
      ]),
    )
    expect(setOf(pos, 'A')).toEqual([1, 2])
    expect(setOf(pos, 'B')).toEqual([1, 2])
    expect(setOf(pos, 'C')).toEqual([3])
  })

  it('keeps a four-way level group fully ambiguous', () => {
    const pos = scenarioPositions(['A', 'B', 'C', 'D'], ptsMap({ A: 1, B: 1, C: 1, D: 1 }), new Map())
    for (const t of ['A', 'B', 'C', 'D']) expect(setOf(pos, t)).toEqual([1, 2, 3, 4])
  })
})
