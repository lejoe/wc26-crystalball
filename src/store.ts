import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { FIXTURES, resultKey } from './data/fixtures'
import { BRACKET_RESULTS } from './data/bracketResults'
import type { AppState, GroupLetter, Outcome, PredScore, Side } from './types'

function initialState(): AppState {
  return {
    predictions: {},
    predScores: {},
    bracketPredictions: {},
  }
}

/** Past matches (with a real score) are fixed and cannot be predicted. */
function isUpcoming(group: GroupLetter, index: number): boolean {
  const f = FIXTURES[group][index]
  return f.hs === null || f.as === null
}

type Store = AppState & {
  setPrediction: (group: GroupLetter, index: number, outcome: Outcome | null) => void
  setScore: (group: GroupLetter, index: number, score: PredScore | null) => void
  setWinner: (matchId: number, side: Side | null) => void
  resetAll: () => void
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      ...initialState(),

      setPrediction: (group, index, outcome) =>
        set((state) => {
          if (!isUpcoming(group, index)) return {}
          const key = resultKey(group, index)
          const predictions = { ...state.predictions }
          const predScores = { ...state.predScores }
          delete predScores[key] // picking an outcome drops any exact score
          if (outcome === null || predictions[key] === outcome) delete predictions[key]
          else predictions[key] = outcome
          return { predictions, predScores }
        }),

      setScore: (group, index, score) =>
        set((state) => {
          if (!isUpcoming(group, index)) return {}
          const key = resultKey(group, index)
          const predictions = { ...state.predictions }
          const predScores = { ...state.predScores }
          if (score === null) {
            delete predScores[key]
          } else {
            predScores[key] = score
            delete predictions[key] // an exact score supersedes the plain outcome
          }
          return { predictions, predScores }
        }),

      setWinner: (matchId, side) =>
        set((state) => {
          if (matchId in BRACKET_RESULTS) return {} // real result locks the pick
          const bracketPredictions = { ...state.bracketPredictions }
          if (side === null || bracketPredictions[matchId] === side) delete bracketPredictions[matchId]
          else bracketPredictions[matchId] = side
          return { bracketPredictions }
        }),

      resetAll: () => set(initialState()),
    }),
    {
      name: 'wc2026-prediction',
      version: 5,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>
        const bracket: Record<number, Side> = {}
        for (const [k, v] of Object.entries(p.bracketPredictions ?? {})) {
          if (v === 'a' || v === 'b') bracket[Number(k)] = v
        }
        return {
          ...current,
          predictions: p.predictions ?? {},
          predScores: p.predScores ?? {},
          bracketPredictions: bracket,
        }
      },
    },
  ),
)
