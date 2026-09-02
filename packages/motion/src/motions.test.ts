import { describe, expect, it } from 'vitest'
import { DURATION, EASE } from '@ap/tokens'
import { MOTIONS } from './motions.js'

const entries = Object.entries(MOTIONS)

describe('MOTIONS record', () => {
  it('defines all twelve named motions from ADR-0010', () => {
    expect(Object.keys(MOTIONS).sort()).toEqual([
      'attention.nudge', 'collapse', 'enter.fade-rise', 'error.shake', 'exit.fade',
      'expand', 'skeleton.shimmer', 'spinner.rotate', 'success.check',
      'toast.slide-in', 'toast.slide-out', 'warning.pulse',
    ])
  })

  it('references only duration and easing tokens that exist in the scale', () => {
    for (const [name, spec] of entries) {
      expect(Object.keys(DURATION), `${name} duration`).toContain(spec.duration)
      expect(Object.keys(EASE), `${name} ease`).toContain(spec.ease)
    }
  })

  it('gives every motion steps running from 0 to 1 in ascending order', () => {
    for (const [name, spec] of entries) {
      const ats = spec.steps.map((s) => s.at)
      expect(ats[0], `${name} first offset`).toBe(0)
      expect(ats.at(-1), `${name} last offset`).toBe(1)
      expect([...ats].sort((a, b) => a - b), `${name} ordering`).toEqual(ats)
      for (const at of ats) expect(at, `${name} offset range`).toBeGreaterThanOrEqual(0)
      for (const at of ats) expect(at, `${name} offset range`).toBeLessThanOrEqual(1)
    }
  })

  it('loops only where the movement is the information (ADR-0010)', () => {
    const infinite = entries.filter(([, s]) => s.iterations === 'infinite').map(([n]) => n)
    // warning.pulse is deliberately finite: perpetual motion is a vestibular
    // hazard and an attention sink.
    expect(infinite.sort()).toEqual(['skeleton.shimmer', 'spinner.rotate'])
  })

  it('gives every opacity-degrading motion an opacity track to degrade to', () => {
    for (const [name, spec] of entries) {
      if (spec.reduced !== 'opacity') continue
      const animatesOpacity = spec.steps.some((s) => s.opacity !== undefined)
      expect(animatesOpacity, `${name} declares reduced:'opacity' but animates no opacity`).toBe(true)
    }
  })

  it('is frozen all the way down, not just at the top', () => {
    expect(Object.isFrozen(MOTIONS)).toBe(true)
    for (const [name, spec] of entries) {
      expect(Object.isFrozen(spec), `${name} spec`).toBe(true)
      expect(Object.isFrozen(spec.steps), `${name} steps`).toBe(true)
      for (const [i, step] of spec.steps.entries()) {
        expect(Object.isFrozen(step), `${name} step ${i}`).toBe(true)
      }
    }
  })

  // These modules are ESM and therefore strict, so a write to a frozen object
  // throws rather than failing silently. Cast away the `as const` readonly
  // types deliberately: they are what a TypeScript caller is stopped by, and
  // what a JavaScript caller never sees. The freeze is the only thing
  // standing between a consumer and a mutated record that both emitters read.
  it('throws rather than silently accepting a mutation, in strict mode', () => {
    const shake = MOTIONS['error.shake'] as unknown as {
      duration: string
      steps: { translateX?: string }[]
    }

    expect(() => {
      shake.steps[1]!.translateX = '-99px'
    }).toThrow(TypeError)
    expect(() => shake.steps.push({ translateX: '0px' })).toThrow(TypeError)
    expect(() => {
      shake.duration = 'instant'
    }).toThrow(TypeError)
    expect(() => {
      ;(MOTIONS as unknown as Record<string, unknown>)['brand.new'] = {}
    }).toThrow(TypeError)

    // ...and nothing moved.
    expect(MOTIONS['error.shake'].steps[1]!.translateX).toBe('-4px')
    expect(MOTIONS['error.shake'].steps).toHaveLength(7)
    expect(MOTIONS['error.shake'].duration).toBe('slow')
  })

  // Neither emitter implements the carry-forward that Step's docblock used to
  // (falsely) claim: emitCss.ts lets native CSS keyframe interpolation ramp
  // across whatever properties a step declares, and emitVariants.ts reads
  // each step's value directly. If one step in a motion omitted a property
  // that another step declared, the two emitters would render visibly
  // different animations from the same MOTIONS record — the exact drift this
  // package exists to prevent. Rather than teach either emitter a
  // carry-forward semantics, sparse steps are outlawed outright: every step
  // of a motion must declare exactly the same set of animatable properties.
  it('declares the same set of animatable properties at every step, so the CSS and JS emitters cannot diverge', () => {
    for (const [name, spec] of entries) {
      const keysOf = (step: (typeof spec.steps)[number]): Set<string> =>
        new Set(
          Object.keys(step).filter(
            (k) => k !== 'at' && (step as Record<string, unknown>)[k] !== undefined,
          ),
        )

      const expected = keysOf(spec.steps[0]!)
      for (let i = 1; i < spec.steps.length; i++) {
        const actual = keysOf(spec.steps[i]!)
        const describe = (s: Set<string>) => `{${[...s].sort().join(', ')}}`
        expect(
          actual,
          `${name}: step ${i} declares ${describe(actual)} but step 0 declares ` +
            `${describe(expected)}. Every step of a motion must declare the same ` +
            'properties — sparse steps are outlawed because neither emitter implements ' +
            "carry-forward (see Step's docblock in types.ts).",
        ).toEqual(expected)
      }
    }
  })
})
