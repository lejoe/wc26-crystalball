import { FIXTURES, resultKey } from './data/fixtures'
import { knownScore } from './standings'
import type { GroupLetter, H2HRecord, Outcome, PredScore } from './types'

/**
 * Head-to-head records from decided matches. Matches with a known score (played
 * or predicted exact score) carry their goal difference; outcome-only
 * predictions carry points only.
 */
export function effectiveH2H(
  predictions: Record<string, Outcome>,
  predScores: Record<string, PredScore>,
): H2HRecord[] {
  const out: H2HRecord[] = []
  for (const g of Object.keys(FIXTURES) as GroupLetter[]) {
    FIXTURES[g].forEach((f, i) => {
      const score = knownScore(g, i, predScores)
      if (score) {
        out.push({
          teamA: f.home,
          teamB: f.away,
          pointsA: score.hs > score.as ? 3 : score.hs < score.as ? 0 : 1,
          gdA: score.hs - score.as,
          goalsA: score.hs,
        })
        return
      }
      const o = predictions[resultKey(g, i)]
      if (!o) return
      out.push({
        teamA: f.home,
        teamB: f.away,
        pointsA: o === 'home' ? 3 : o === 'away' ? 0 : 1,
        gdA: 0,
        goalsA: 0,
      })
    })
  }
  return out
}
