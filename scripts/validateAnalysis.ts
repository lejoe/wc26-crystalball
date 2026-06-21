/**
 * Render-safe structural validation of src/data/groupAnalysis.json. Checks the
 * shape the UI relies on — block types, tones, levers, required text — without
 * re-deriving any facts (the engine facts handed to the AI are trusted). Also
 * confirms each present group's fingerprint matches the current real results, so
 * a stale artifact is caught.
 *
 *   npx tsx scripts/validateAnalysis.ts
 *
 * Exits non-zero and prints every problem on failure.
 */
import analysis from '../src/data/groupAnalysis.json'
import { GROUP_LETTERS, GROUPS } from '../src/data/groups'
import { analysisReady, groupFingerprint } from '../src/groupAnalysis'
import type { GroupLetter } from '../src/types'

const TONES = new Set(['through', 'in-balance', 'out'])
const BLOCK_TYPES = new Set([
  'verdict',
  'advancement-scenario',
  'position-scenario',
  'tiebreaker-note',
  'third-place-lean',
  'elimination',
  'nothing-left',
])
const LEVERS = new Set(['h2h', 'gd', 'goals'])
const LEANS = new Set([undefined, 'favourable', 'borderline', 'unfavourable'])
const RESULTS = new Set(['win', 'draw', 'lose'])

const errors: string[] = []
const fail = (where: string, msg: string) => errors.push(`${where}: ${msg}`)

const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0

function checkBlock(where: string, b: any): void {
  if (!b || typeof b !== 'object') {
    fail(where, 'block is not an object')
    return
  }
  if (!BLOCK_TYPES.has(b.type)) {
    fail(where, `unknown block type "${b.type}"`)
    return
  }
  if (b.type !== 'advancement-scenario' && !text(b.text)) fail(where, `${b.type} missing text`)
  if (b.type === 'verdict' && !TONES.has(b.tone)) fail(where, `verdict bad tone "${b.tone}"`)
  if (b.type === 'tiebreaker-note' && !LEVERS.has(b.lever)) fail(where, `tiebreaker bad lever "${b.lever}"`)
  if (b.type === 'third-place-lean' && !LEANS.has(b.lean)) fail(where, `lean bad value "${b.lean}"`)
  if (b.type === 'advancement-scenario') {
    if (!text(b.text)) fail(where, 'advancement-scenario missing text')
    if (b.breakdown !== undefined) {
      if (!Array.isArray(b.breakdown)) fail(where, 'breakdown not an array')
      else
        b.breakdown.forEach((x: any, i: number) => {
          if (!RESULTS.has(x?.result)) fail(`${where}.breakdown[${i}]`, `bad result "${x?.result}"`)
          if (!text(x?.text)) fail(`${where}.breakdown[${i}]`, 'missing text')
        })
    }
  }
}

const groups = (analysis as any).groups
if (!groups || typeof groups !== 'object') {
  fail('root', 'missing "groups" object')
} else {
  for (const key of Object.keys(groups)) {
    if (!GROUP_LETTERS.includes(key as GroupLetter)) fail(`groups.${key}`, 'not a valid group letter')
    const g = groups[key]
    const where = `Group ${key}`
    if (g.group !== key) fail(where, `group field "${g.group}" != key`)
    if (!analysisReady(key as GroupLetter)) fail(where, 'present but not in the ready window')
    else if (g.fingerprint !== groupFingerprint(key as GroupLetter))
      fail(where, `stale fingerprint (artifact "${g.fingerprint}" != current "${groupFingerprint(key as GroupLetter)}")`)

    const teamNames = new Set(GROUPS[key as GroupLetter])
    if (!Array.isArray(g.overview)) fail(where, 'overview not an array')
    else {
      if (g.overview.length !== teamNames.size) fail(where, `overview has ${g.overview.length} lines, expected ${teamNames.size}`)
      g.overview.forEach((l: any, i: number) => {
        if (!teamNames.has(l?.team)) fail(`${where}.overview[${i}]`, `unknown team "${l?.team}"`)
        if (!TONES.has(l?.tone)) fail(`${where}.overview[${i}]`, `bad tone "${l?.tone}"`)
        if (!text(l?.line)) fail(`${where}.overview[${i}]`, 'missing line')
      })
    }
    if (!g.teams || typeof g.teams !== 'object') fail(where, 'missing teams map')
    else
      for (const team of Object.keys(g.teams)) {
        if (!teamNames.has(team)) fail(`${where}.teams`, `unknown team "${team}"`)
        const blocks = g.teams[team]
        if (!Array.isArray(blocks)) fail(`${where}.teams.${team}`, 'blocks not an array')
        else blocks.forEach((b: any, i: number) => checkBlock(`${where}.${team}[${i}]`, b))
      }
  }
}

if (errors.length) {
  throw new Error(
    `groupAnalysis.json invalid (${errors.length} problem(s)):\n` + errors.map((e) => '  - ' + e).join('\n'),
  )
}
console.log('groupAnalysis.json valid:', Object.keys(groups).length, 'group(s).')
