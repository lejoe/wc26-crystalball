import { describe, expect, it } from 'vitest'
import { buildFinishedView } from './finishedAnalysis'
import { MATCH_BY_ID } from './data/bracket'
import type { MatchView, SlotView } from './bracketResolve'
import type { Side } from './types'

const slot = (team: string | null): SlotView => ({
  team,
  certain: team != null,
  confirmed: false,
  candidates: [],
  label: '',
})

const mv = (id: number, a: string | null, b: string | null, winnerSide: Side | null = null): MatchView => ({
  def: MATCH_BY_ID[id],
  a: slot(a),
  b: slot(b),
  winnerSide,
})

const viewsOf = (...rows: MatchView[]): Record<number, MatchView> =>
  Object.fromEntries(rows.map((v) => [v.def.id, v]))

describe('buildFinishedView', () => {
  it('marks a 4th-placed team out in the group phase', () => {
    const v = buildFinishedView('Foo', 4, {}, false)
    expect(v.kind).toBe('out-group')
    expect(v.path).toHaveLength(0)
  })

  it('shows the best-third race for an unassigned 3rd while groups remain open', () => {
    const v = buildFinishedView('Foo', 3, {}, false)
    expect(v.kind).toBe('third-undecided')
  })

  it('marks an unassigned 3rd out once every group is decided', () => {
    const v = buildFinishedView('Foo', 3, {}, true)
    expect(v.kind).toBe('out-group')
  })

  it('gives an R32 team a three-round path (R32 + R16 + QF)', () => {
    // 1st A feeds R32 match 79 → R16 match 92 → QF match 99.
    const views = viewsOf(mv(79, 'Mexico', '3rd ?'), mv(92, null, null), mv(99, null, null))
    const v = buildFinishedView('Mexico', 1, views, false)
    expect(v.kind).toBe('advanced')
    expect(v.anchorRound).toBe('R32')
    expect(v.path.map((p) => p.def.id)).toEqual([79, 92, 99])
    expect(v.knockedOut).toBe(false)
  })

  it('gives an R16-anchored team a two-round path (R16 + QF)', () => {
    // Synthetic: team first appears at R16 match 89 → QF match 97.
    const views = viewsOf(mv(89, 'Mexico', null), mv(97, null, null))
    const v = buildFinishedView('Mexico', 1, views, false)
    expect(v.anchorRound).toBe('R16')
    expect(v.path.map((p) => p.def.id)).toEqual([89, 97])
  })
})
