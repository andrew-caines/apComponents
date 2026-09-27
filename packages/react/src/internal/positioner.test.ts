import { SPACE } from '@ap/tokens'
import { describe, expect, it } from 'vitest'
import { POSITIONER_SIDE_OFFSET } from './positioner.js'

describe('POSITIONER_SIDE_OFFSET', () => {
  it('is SPACE[2] parsed to a number', () => {
    // Perturbation: temporarily change SPACE['2'] in scales.ts (a scratch
    // edit, reverted after) while POSITIONER_SIDE_OFFSET stays a hardcoded
    // `4` — this assertion must fail, since it recomputes the expectation
    // from the live SPACE value rather than repeating the literal.
    expect(POSITIONER_SIDE_OFFSET).toBe(Number.parseFloat(SPACE['2']!))
  })

  it('is a finite number', () => {
    expect(Number.isFinite(POSITIONER_SIDE_OFFSET)).toBe(true)
  })
})
