import { describe, expect, it, vi } from 'vitest'

// The scenario tests own their input data: we mock the fixtures module with
// hardcoded scores so the trees are deterministic and survive daily result
// updates to the real fixtures.ts. Real match pairings (home/away/round) are
// preserved; only the scores are replaced. Round 3 (indices 4,5) stays pending,
// and every group except A/B/C is left unplayed so only those three are "ready".
//
// These scores reproduce the exact situations verified in the browser:
//   A: Mexico through; Czechia both-win goal-difference battle; Korea merge.
//   B: a final-margin swing can still drop Switzerland/Canada to 3rd or lift
//      Bosnia/Qatar to 2nd; Bosnia 3rd-vs-4th draw stays GD-deterministic.
//   C: Haiti eliminated.
vi.mock('./data/fixtures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./data/fixtures')>()
  const SCORES: Partial<Record<string, ([number, number] | null)[]>> = {
    A: [[2, 0], [2, 1], [1, 1], [1, 0], null, null],
    B: [[1, 1], [1, 1], [4, 1], [6, 0], null, null],
    C: [[1, 1], [0, 1], [0, 1], [3, 0], null, null],
  }
  const FIXTURES = Object.fromEntries(
    Object.entries(actual.FIXTURES).map(([g, fx]) => [
      g,
      fx.map((f, i) => {
        const s = SCORES[g]?.[i] ?? null
        return { ...f, hs: s ? s[0] : null, as: s ? s[1] : null }
      }),
    ]),
  ) as typeof actual.FIXTURES
  return { ...actual, FIXTURES }
})

import { analysisReady, enumerate, groupAnalysisFacts, groupFingerprint } from './groupAnalysis'
import { buildGroupScenarios, gdVerdict } from './scenarioTree'
import type { ChoiceNode, EndNode, GdNoteNode, MarginsNode, Node, Opt } from './scenarioTree'
import { groupStandings } from './standings'

describe('gdVerdict (goal-difference tiebreak, unbounded margins)', () => {
  it('keeps the order open when the subject loses while the rival wins', () => {
    // Switzerland (+3) loses, Qatar (-5) wins: a heavy enough loss + big win flips
    // it, so 3rd must stay reachable rather than collapsing to a locked 2nd.
    expect(gdVerdict('lose', 'win', 3, -5)).toBe('open')
  })

  it('keeps the order open when the subject wins while the rival loses', () => {
    // Bosnia (-3) wins big while Canada (+6) loses big can overtake on GD.
    expect(gdVerdict('win', 'lose', -3, 6)).toBe('open')
  })

  it('resolves two draws on current goal difference (no margins can move)', () => {
    expect(gdVerdict('draw', 'draw', -3, -5)).toBe('self')
    expect(gdVerdict('draw', 'draw', -5, -3)).toBe('rival')
  })

  it('a win cannot be caught by a rival who only draws when already ahead', () => {
    expect(gdVerdict('win', 'draw', 2, 0)).toBe('self')
  })

  it('both teams winning distinct games is always open', () => {
    expect(gdVerdict('win', 'win', 5, -5)).toBe('open')
  })
})

const asChoice = (n: Node | undefined): ChoiceNode => {
  expect(n?.type).toBe('choice')
  return n as ChoiceNode
}
const optByLabel = (n: ChoiceNode, label: string): Opt => {
  const o = n.options.find((x) => x.label === label)
  expect(o, `option "${label}" of [${n.options.map((x) => x.label).join(', ')}]`).toBeDefined()
  return o!
}
const statusOf = (group: 'A' | 'B' | 'C', team: string) =>
  groupAnalysisFacts(group).teams.find((t) => t.team === team)!.status

// Every place label a tree can resolve to, for display invariant checks.
function leafPlaces(node: Node): string[] {
  switch (node.type) {
    case 'end':
      return [node.place]
    case 'gdnote':
      return [node.result.place]
    case 'margins':
      return [node.win.place, node.lose.place]
    case 'choice':
      return node.options.flatMap((o) => leafPlaces(o.child))
  }
}

// Every leaf's certified engine position set (1-based), for consistency checks.
function leafSets(node: Node): number[][] {
  switch (node.type) {
    case 'end':
    case 'gdnote':
    case 'margins':
      return [node.set]
    case 'choice':
      return node.options.flatMap((o) => leafSets(o.child))
  }
}

describe('analysisReady window', () => {
  it('is open only for groups whose first two rounds are played', () => {
    expect(analysisReady('A')).toBe(true)
    expect(analysisReady('B')).toBe(true)
    expect(analysisReady('C')).toBe(true)
    expect(analysisReady('D')).toBe(false)
    expect(analysisReady('L')).toBe(false)
  })
  it('builds no trees for groups outside the window', () => {
    expect(buildGroupScenarios('D')).toEqual({})
  })
})

describe('enumerate', () => {
  it('produces 3^remaining scenarios over the undecided matches', () => {
    const { remaining, scenarios } = enumerate('A', groupStandings('A', {}, {}))
    expect(remaining).toHaveLength(2)
    expect(scenarios).toHaveLength(9)
  })
  it('fingerprints the group from its real scores', () => {
    expect(groupFingerprint('A')).toBe('2:0|2:1|1:1|1:0|-|-')
  })
})

describe('Group A trees', () => {
  const trees = buildGroupScenarios('A')

  it('a through team shows a single "Any result" option to its locked place', () => {
    expect(statusOf('A', 'Mexico')).toBe('through')
    const root = asChoice(trees['Mexico'])
    expect(root.kind).toBe('own')
    expect(root.options).toHaveLength(1)
    expect(root.options[0].label).toBe('Any result')
    const leaf = root.options[0].child as EndNode
    expect(leaf.type).toBe('end')
    expect(leaf.place).toBe('1st')
    expect(leaf.zone).toBe('good')
    expect(leaf.opponents?.kind).toBe('thirds')
  })

  it('merges own results with the same outcome (Korea: win or draw -> 2nd)', () => {
    const root = asChoice(trees['Korea Republic'])
    const wod = optByLabel(root, 'Win or draw')
    expect(wod.place).toBe('2nd')
    expect((wod.child as EndNode).place).toBe('2nd')
    // Losing keeps a reachable 3rd visible alongside out.
    const lose = optByLabel(root, 'Lose')
    expect(lose.place).toBe('3rd / Out')
    const parallel = asChoice(lose.child)
    expect(parallel.kind).toBe('parallel')
    const places = parallel.options.map((o) => o.place)
    expect(places).toContain('3rd')
    expect(places).toContain('Out')
  })

  it('uses the interactive margins stepper only when both tied teams win distinct games', () => {
    const root = asChoice(trees['Czechia'])
    const win = optByLabel(root, 'Win')
    expect(win.place).toBe('2nd / 3rd')
    const parallel = asChoice(win.child)
    const margins = parallel.options.map((o) => o.child).find((c) => c.type === 'margins') as
      | MarginsNode
      | undefined
    expect(margins).toBeDefined()
    expect(margins!.self.team).toBe('Czechia')
    expect([margins!.win.place, margins!.lose.place]).toEqual(['2nd', '3rd'])
    // A draw or loss can't reach the top two but keeps the 3rd path visible.
    expect(optByLabel(root, 'Draw').place).toBe('3rd / Out')
    expect(optByLabel(root, 'Lose').place).toBe('3rd / Out')
  })
})

describe('Group B trees (goal difference can still swing on the final margins)', () => {
  const trees = buildGroupScenarios('B')

  it('a win or draw keeps the better-GD leader top (Canada -> 1st), but a heavy loss can still drop it to 3rd', () => {
    const root = asChoice(trees['Canada'])
    const wod = optByLabel(root, 'Win or draw')
    expect(wod.place).toBe('1st')
    expect((wod.child as EndNode).place).toBe('1st')
    // Canada (+6) drew Bosnia head-to-head, so a big enough loss while Bosnia
    // wins big flips the goal-difference order: 3rd is live, not a locked 2nd.
    expect(optByLabel(root, 'Lose').place).toBe('2nd / 3rd')
  })

  it('Switzerland is through on a win or draw, but a loss leaves 3rd reachable', () => {
    const root = asChoice(trees['Switzerland'])
    expect(optByLabel(root, 'Win').place).toBe('1st')
    expect(optByLabel(root, 'Draw').place).toBe('2nd')
    // The reported bug: "Draw or lose -> 2nd" hid that a loss (with Qatar beating
    // Bosnia) can still drop Switzerland to 3rd on goal difference.
    const lose = optByLabel(root, 'Lose')
    expect(lose.place).toBe('2nd / 3rd')
    const parallel = asChoice(lose.child)
    expect(parallel.kind).toBe('parallel')
    expect(parallel.options.map((o) => o.place)).toContain('2nd / 3rd')
  })

  it('a draw resolves 3rd-vs-4th deterministically on goal difference (Bosnia -> 3rd); a win can even reach 2nd', () => {
    const root = asChoice(trees['Bosnia and Herzegovina'])
    expect(optByLabel(root, 'Win').place).toBe('2nd / 3rd')
    expect(optByLabel(root, 'Lose').place).toBe('Out')

    const draw = optByLabel(root, 'Draw')
    expect(draw.place).toBe('3rd')
    const gd = draw.child as GdNoteNode
    expect(gd.type).toBe('gdnote')
    expect(gd.self.team).toBe('Bosnia and Herzegovina')
    expect(gd.rival.team).toBe('Qatar')
    expect(gd.self.gd).toBeGreaterThan(gd.rival.gd) // -3 vs -5
    expect(gd.result.place).toBe('3rd')
  })

  it('the bottom team can still snatch 2nd with a big enough win (Qatar)', () => {
    const root = asChoice(trees['Qatar'])
    expect(optByLabel(root, 'Win').place).toBe('2nd / 3rd')
    expect(optByLabel(root, 'Draw or lose').place).toBe('Out')
  })
})

describe('Group C trees', () => {
  it('an eliminated team shows "Any result -> Out"', () => {
    const trees = buildGroupScenarios('C')
    expect(statusOf('C', 'Haiti')).toBe('out')
    const root = asChoice(trees['Haiti'])
    expect(root.options).toHaveLength(1)
    expect(root.options[0].label).toBe('Any result')
    expect((root.options[0].child as EndNode).place).toBe('Out')
  })
})

describe('structural invariants (all ready groups)', () => {
  const groups = ['A', 'B', 'C'] as const

  it('every team tree is rooted in an own-result choice', () => {
    for (const g of groups) {
      for (const root of Object.values(buildGroupScenarios(g))) {
        expect(root.type).toBe('choice')
        expect((root as ChoiceNode).kind).toBe('own')
      }
    }
  })

  it('merges own results that land on the same definite place (3rd may repeat with different odds)', () => {
    for (const g of groups) {
      for (const root of Object.values(buildGroupScenarios(g))) {
        // Two options sharing 1st/2nd/Out would be an unmerged duplicate; 3rd is
        // allowed to repeat because best-third odds differ by points.
        const definite = (root as ChoiceNode).options
          .map((o) => leafPlaces(o.child))
          .filter((ps) => new Set(ps).size === 1)
          .map((ps) => ps[0])
          .filter((p) => p !== '3rd')
        expect(new Set(definite).size).toBe(definite.length)
      }
    }
  })

  it('never collapses a reachable 3rd into a bare "Out"', () => {
    for (const g of groups) {
      for (const root of Object.values(buildGroupScenarios(g))) {
        for (const opt of (root as ChoiceNode).options) {
          const places = leafPlaces(opt.child)
          if (opt.place === 'Out') expect(places).not.toContain('3rd')
        }
      }
    }
  })

  it('every parallel choice genuinely branches the outcome (no redundant watch step)', () => {
    const walk = (node: Node) => {
      if (node.type !== 'choice') return
      if (node.kind === 'parallel') {
        const sets = node.options.map((o) => leafPlaces(o.child).join('|'))
        expect(new Set(sets).size).toBeGreaterThan(1)
      }
      node.options.forEach((o) => walk(o.child))
    }
    for (const g of groups) for (const root of Object.values(buildGroupScenarios(g))) walk(root)
  })
})

describe('path consistency with the engine', () => {
  const groups = ['A', 'B', 'C'] as const

  // Note: leaf sets are a SUBSET of engine-reachable, not equal — a goal-difference
  // tie the engine leaves open (e.g. {2,3}) is resolved to one place by a gdnote and
  // the dropped position never appears. So the invariant is one-directional.
  it('no leaf can reach a position the engine rules out', () => {
    for (const g of groups) {
      const facts = groupAnalysisFacts(g)
      const trees = buildGroupScenarios(g)
      for (const [team, root] of Object.entries(trees)) {
        const reachable = new Set(facts.teams.find((t) => t.team === team)!.reachable)
        for (const set of leafSets(root)) {
          for (const p of set) expect(reachable.has(p), `${g} ${team} pos ${p}`).toBe(true)
        }
      }
    }
  })
})
