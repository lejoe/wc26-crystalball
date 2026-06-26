import { describe, expect, it } from 'vitest'
import { decodePredictions, encodePredictions, hasAnyPicks } from './share'
import type { AppState } from './types'

const empty: AppState = { predictions: {}, predScores: {}, bracketPredictions: {} }

const state = (over: Partial<AppState>): AppState => ({ ...empty, ...over })

describe('share encode/decode', () => {
  it('round-trips a mixed prediction set', () => {
    const s = state({
      predictions: { 'A:4': 'away', 'L:5': 'draw' },
      predScores: { 'B:5': { hs: 2, as: 1 }, 'C:3': { hs: 0, as: 10 } },
      bracketPredictions: { 73: 'a', 104: 'b', 90: 'a' },
    })
    expect(decodePredictions(encodePredictions(s))).toEqual({
      predictions: s.predictions,
      predScores: s.predScores,
      bracketPredictions: s.bracketPredictions,
    })
  })

  it('round-trips an empty set', () => {
    expect(decodePredictions(encodePredictions(empty))).toEqual(empty)
  })

  it('keeps a single-pick token short', () => {
    const token = encodePredictions(state({ bracketPredictions: { 73: 'a' } }))
    expect(token.length).toBeLessThan(20)
  })

  it('a full set stays well under the 2 KB URL budget', () => {
    const predScores: AppState['predScores'] = {}
    for (const g of 'ABCDEFGHIJKL') for (let i = 0; i < 6; i++) predScores[`${g}:${i}`] = { hs: 3, as: 2 }
    const bracketPredictions: AppState['bracketPredictions'] = {}
    for (let id = 73; id <= 104; id++) bracketPredictions[id] = 'a'
    const token = encodePredictions(state({ predScores, bracketPredictions }))
    expect(token.length).toBeLessThan(2048)
  })

  it('returns null on unknown version', () => {
    const token = encodePredictions(state({ bracketPredictions: { 73: 'a' } }))
    expect(decodePredictions(`9${token.slice(1)}`)).toBeNull()
  })

  it('returns null on garbage', () => {
    expect(decodePredictions('not-a-token')).toBeNull()
    expect(decodePredictions('1:!!!!')).toBeNull()
    expect(decodePredictions('')).toBeNull()
  })

  it('hasAnyPicks reflects set picks', () => {
    expect(hasAnyPicks(empty)).toBe(false)
    expect(hasAnyPicks(state({ predictions: { 'A:0': 'home' } }))).toBe(true)
  })
})
