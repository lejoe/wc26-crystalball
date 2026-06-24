import { describe, expect, it } from 'vitest'
import { rankThirdPlace, rankThirds, type ThirdKey } from './standings'
import type { GroupLetter, TeamStanding } from './types'

const st = (team: string, w: number, d: number, l: number, gf: number, ga: number): TeamStanding => ({
  team,
  played: w + d + l,
  won: w,
  drawn: d,
  lost: l,
  goalsFor: gf,
  goalsAgainst: ga,
})

const e = (group: GroupLetter, points: number, gd: number, gf: number, team = group): ThirdKey & { team: string } => ({
  group,
  points,
  gd,
  gf,
  team,
})

const order = <T extends { team: string }>(rows: T[]) => rows.map((r) => r.team)

describe('rankThirds — best-third cascade', () => {
  it('orders by points first', () => {
    const ranked = rankThirds([e('A', 3, 0, 2), e('B', 6, -5, 1), e('C', 4, 9, 9)])
    expect(order(ranked)).toEqual(['B', 'C', 'A'])
  })

  it('breaks points ties on goal difference', () => {
    const ranked = rankThirds([e('A', 3, 0, 4), e('B', 3, 2, 1), e('C', 3, -1, 9)])
    expect(order(ranked)).toEqual(['B', 'A', 'C'])
  })

  it('breaks points+GD ties on goals scored', () => {
    const ranked = rankThirds([e('A', 3, 1, 2), e('B', 3, 1, 5), e('C', 3, 1, 3)])
    expect(order(ranked)).toEqual(['B', 'C', 'A'])
  })

  it('falls back to group letter when fully level', () => {
    const ranked = rankThirds([e('F', 3, 1, 2), e('B', 3, 1, 2), e('D', 3, 1, 2)])
    expect(order(ranked)).toEqual(['B', 'D', 'F'])
  })

  it('assigns a 1-based sequential rank', () => {
    const ranked = rankThirds([e('A', 1, 0, 0), e('B', 7, 0, 0), e('C', 4, 0, 0)])
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3])
    expect(ranked.find((r) => r.team === 'B')!.rank).toBe(1)
    expect(ranked.find((r) => r.team === 'A')!.rank).toBe(3)
  })

  it('is order-independent (input order does not affect the result)', () => {
    const input = [e('A', 3, 0, 2), e('B', 6, -5, 1), e('C', 4, 9, 9), e('D', 3, 1, 0)]
    const a = order(rankThirds(input))
    const b = order(rankThirds([...input].reverse()))
    expect(a).toEqual(b)
  })

  it('preserves extra fields on each entry', () => {
    const ranked = rankThirds([{ ...e('A', 3, 0, 0), toPlay: true }])
    expect(ranked[0].toPlay).toBe(true)
    expect(ranked[0].rank).toBe(1)
  })

  it('re-ranks correctly when a group third is substituted (scenario branch)', () => {
    // Live race: A and B level on 1 pt below a cluster on 3 pts.
    const live = [e('C', 3, 1, 4), e('D', 3, 0, 2), e('A', 1, -1, 1), e('E', 1, -2, 0)]
    // Branch fixes group A's third as a 4-pt team — it should jump to the top.
    const branch = rankThirds([...live.filter((r) => r.group !== 'A'), e('A', 4, 2, 5)])
    expect(order(branch)).toEqual(['A', 'C', 'D', 'E'])
    expect(branch.find((r) => r.team === 'A')!.rank).toBe(1)
  })
})

describe('rankThirdPlace — picks each group’s 3rd, then ranks across groups', () => {
  it('selects the position-3 team per group and orders them', () => {
    // Each group: 1st, 2nd, then the 3rd-placed team we care about, then 4th.
    const groups = {
      A: [st('A1', 3, 0, 0, 9, 0), st('A2', 2, 0, 1, 5, 3), st('A3', 1, 0, 2, 4, 6), st('A4', 0, 0, 3, 0, 9)],
      B: [st('B1', 3, 0, 0, 9, 0), st('B2', 2, 0, 1, 5, 3), st('B3', 1, 0, 2, 2, 6), st('B4', 0, 0, 3, 0, 9)],
    } as Record<GroupLetter, TeamStanding[]>

    const ranked = rankThirdPlace(groups, [])
    // Both thirds have 1 pt; A3 has the better goal difference (-2 vs -4).
    expect(ranked.map((r) => r.standing.team)).toEqual(['A3', 'B3'])
    expect(ranked.map((r) => r.rank)).toEqual([1, 2])
  })

  it('omits groups whose 3rd-placed team has played no matches', () => {
    const groups = {
      A: [st('A1', 1, 0, 0, 3, 0), st('A2', 0, 1, 0, 1, 1), st('A3', 0, 1, 0, 1, 1), st('A4', 0, 0, 0, 0, 0)],
      B: [st('B1', 0, 0, 0, 0, 0), st('B2', 0, 0, 0, 0, 0), st('B3', 0, 0, 0, 0, 0), st('B4', 0, 0, 0, 0, 0)],
    } as Record<GroupLetter, TeamStanding[]>

    const ranked = rankThirdPlace(groups, [])
    expect(ranked.map((r) => r.group)).toEqual(['A'])
  })
})
