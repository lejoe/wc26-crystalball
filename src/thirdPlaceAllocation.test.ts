import { describe, expect, it } from 'vitest'
import { THIRD_PLACE_ALLOCATION } from './data/thirdPlaceAllocation'
import { MATCHES } from './data/bracket'
import type { GroupLetter, SlotSource } from './types'

const SLOTS = MATCHES.flatMap((m) =>
  [m.a, m.b].filter((s): s is Extract<SlotSource, { kind: 'third' }> => s.kind === 'third'),
)
const SLOT_IDS = SLOTS.map((s) => s.slot).sort()

describe('THIRD_PLACE_ALLOCATION — FIFA Annexe C table', () => {
  it('covers all C(12,8)=495 combinations of qualifying third-place groups', () => {
    expect(Object.keys(THIRD_PLACE_ALLOCATION)).toHaveLength(495)
  })

  it('keys are sorted, distinct 8-group combinations from A–L', () => {
    for (const key of Object.keys(THIRD_PLACE_ALLOCATION)) {
      const letters = key.split('')
      expect(letters).toHaveLength(8)
      expect(new Set(letters).size).toBe(8)
      expect([...letters].sort().join('')).toBe(key)
      expect(letters.every((l) => l >= 'A' && l <= 'L')).toBe(true)
    }
  })

  it('every row fills exactly the eight R32 third-place slots', () => {
    for (const row of Object.values(THIRD_PLACE_ALLOCATION)) {
      expect(Object.keys(row).sort()).toEqual(SLOT_IDS)
    }
  })

  it('each row is a bijection of the qualifying groups onto the slots', () => {
    for (const [key, row] of Object.entries(THIRD_PLACE_ALLOCATION)) {
      const assigned = Object.values(row).sort().join('')
      expect(assigned).toBe(key)
    }
  })

  it('per-slot group unions match the allowed groups declared in bracket.ts', () => {
    const allowed = new Map(SLOTS.map((s) => [s.slot, new Set<GroupLetter>(s.groups)]))
    const union = new Map(SLOTS.map((s) => [s.slot, new Set<GroupLetter>()]))
    for (const row of Object.values(THIRD_PLACE_ALLOCATION)) {
      for (const [slot, group] of Object.entries(row)) union.get(slot)!.add(group)
    }
    for (const slot of SLOT_IDS) {
      expect([...union.get(slot)!].sort()).toEqual([...allowed.get(slot)!].sort())
    }
  })

  it('assigns each group only to a slot that permits it', () => {
    const allowed = new Map(SLOTS.map((s) => [s.slot, new Set<GroupLetter>(s.groups)]))
    for (const row of Object.values(THIRD_PLACE_ALLOCATION)) {
      for (const [slot, group] of Object.entries(row)) {
        expect(allowed.get(slot)!.has(group)).toBe(true)
      }
    }
  })
})
