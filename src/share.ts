import { GROUP_LETTERS } from './data/groups'
import { MATCHES } from './data/bracket'
import { FIXTURES } from './data/fixtures'
import type { AppState, Outcome, PredScore, Side } from './types'

/**
 * Shareable-link encoding for a prediction set. Picks are encoded positionally
 * against the fixed canonical order (groups A–L × their fixtures, then the
 * bracket match ids), so only values per slot are stored — never keys. The token
 * is base64url'd and carried in the URL hash, prefixed with a version tag so the
 * format can evolve without misreading old links.
 */

const VERSION = '1'

/** Canonical bracket order: match ids 73–104, in fixture order. */
const BRACKET_IDS = MATCHES.map((m) => m.id)

const OUTCOME_CODE: Record<Outcome, string> = { home: 'h', draw: 'd', away: 'a' }
const CODE_OUTCOME: Record<string, Outcome> = { h: 'home', d: 'draw', a: 'away' }

// The token is pure ASCII (digits and `hda-.~0ab`), so plain btoa/atob suffice.
function base64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(s: string): string {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
}

/** Drop trailing entries equal to `empty` so a partial set yields a short token. */
function trimTrailing<T>(arr: T[], empty: T): T[] {
  let end = arr.length
  while (end > 0 && arr[end - 1] === empty) end--
  return arr.slice(0, end)
}

/**
 * Encode the set picks into a versioned payload for a `#p=` URL fragment.
 * Group section: per slot `` (unset) / `h|d|a` (outcome) / `hs-as` (exact score),
 * joined by `.`. Bracket section: per slot `0` (unset) / `a` / `b`, concatenated.
 * The two sections are separated by `~`.
 */
export function encodePredictions(state: AppState): string {
  const groupTokens: string[] = []
  for (const g of GROUP_LETTERS) {
    for (let i = 0; i < FIXTURES[g].length; i++) {
      const key = `${g}:${i}`
      const score = state.predScores[key]
      if (score) groupTokens.push(`${score.hs}-${score.as}`)
      else if (state.predictions[key]) groupTokens.push(OUTCOME_CODE[state.predictions[key]])
      else groupTokens.push('')
    }
  }
  const bracketChars = BRACKET_IDS.map((id) => state.bracketPredictions[id] ?? '0')

  const groupsPart = trimTrailing(groupTokens, '').join('.')
  const bracketPart = trimTrailing(bracketChars, '0').join('')
  return `${VERSION}:${base64urlEncode(`${groupsPart}~${bracketPart}`)}`
}

/**
 * Decode a payload back into a sparse prediction set. Returns `null` for any
 * malformed / unknown-version input so the caller can ignore it gracefully.
 * Does NOT enforce real-result priority — that is the importer's job.
 */
export function decodePredictions(payload: string): Partial<AppState> | null {
  try {
    const sep = payload.indexOf(':')
    if (sep === -1) return null
    if (payload.slice(0, sep) !== VERSION) return null

    const token = base64urlDecode(payload.slice(sep + 1))
    const tilde = token.indexOf('~')
    if (tilde === -1) return null

    const slots = token.slice(0, tilde) ? token.slice(0, tilde).split('.') : []
    const bracketPart = token.slice(tilde + 1)

    const predictions: Record<string, Outcome> = {}
    const predScores: Record<string, PredScore> = {}
    let idx = 0
    for (const g of GROUP_LETTERS) {
      for (let i = 0; i < FIXTURES[g].length; i++, idx++) {
        const tok = slots[idx]
        if (!tok) continue
        const key = `${g}:${i}`
        if (tok in CODE_OUTCOME) {
          predictions[key] = CODE_OUTCOME[tok]
        } else {
          const m = /^(\d{1,2})-(\d{1,2})$/.exec(tok)
          if (!m) return null
          predScores[key] = { hs: Number(m[1]), as: Number(m[2]) }
        }
      }
    }

    const bracketPredictions: Record<number, Side> = {}
    for (let i = 0; i < BRACKET_IDS.length; i++) {
      const c = bracketPart[i]
      if (c === 'a' || c === 'b') bracketPredictions[BRACKET_IDS[i]] = c
    }

    return { predictions, predScores, bracketPredictions }
  } catch {
    return null
  }
}

/** Whether a state holds any set pick at all (used to gate the share button). */
export function hasAnyPicks(state: AppState): boolean {
  return (
    Object.keys(state.predictions).length > 0 ||
    Object.keys(state.predScores).length > 0 ||
    Object.keys(state.bracketPredictions).length > 0
  )
}

/** Build the full shareable URL for the current origin. */
export function shareUrl(state: AppState): string {
  return `${location.origin}${location.pathname}#p=${encodePredictions(state)}`
}
