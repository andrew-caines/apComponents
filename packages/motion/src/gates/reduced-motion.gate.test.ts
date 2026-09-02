import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MOTIONS } from '../motions.js'
import { cssKeyframeName } from '../emitCss.js'
import { parseMotionCss } from './parseMotionCss.js'

const css = readFileSync(join(import.meta.dirname, '../motion.css'), 'utf8')
const { reduced } = parseMotionCss(css)

describe('gate: every motion has a reduced-motion definition', () => {
  it('defines a reduced form for all twelve, none missing', () => {
    expect(Object.keys(reduced).sort()).toEqual(
      Object.keys(MOTIONS).map(cssKeyframeName).sort(),
    )
  })

  for (const [name, spec] of Object.entries(MOTIONS)) {
    const kf = cssKeyframeName(name)

    if (spec.reduced === 'opacity') {
      it(`${name}: degrades to opacity alone`, () => {
        const steps = reduced[kf]!
        const props = new Set(steps.flatMap((s) => Object.keys(s.props)))
        expect(props, `${name} should animate only opacity when reduced`).toEqual(
          new Set(['opacity']),
        )

        // The property-set check above passes as long as the ONLY key present
        // is 'opacity' — it says nothing about the value at each offset. A
        // perturbation that keeps the right property but emits the wrong
        // number (e.g. every reduced stop hardcoded to `opacity: 0.5`) sails
        // through it untouched, because the set is still exactly {opacity}.
        // Compare offsets AND values against what MOTIONS actually declares
        // for this motion's opacity-bearing steps, read back from the
        // committed artifact rather than trusted from either emitter.
        const expected = spec.steps
          .filter((s) => s.opacity !== undefined)
          .map((s) => ({ at: s.at, opacity: String(s.opacity) }))
        const actual = steps.map((s) => ({ at: s.at, opacity: s.props['opacity'] }))
        expect(actual, `${name} reduced opacity values must match the MOTIONS record`).toEqual(
          expected,
        )
      })
    } else {
      it(`${name}: degrades to no visual change, but still exists`, () => {
        // Still present so animationend still fires — a component that
        // unmounts on that event must behave identically under reduced motion.
        const steps = reduced[kf]
        expect(steps, `${name} missing entirely`).toBeDefined()

        // Exactly two stops, at 0 and 1 — not merely "no properties wherever
        // it happens to appear". A gate that only flattened prop keys across
        // however many stops exist would still pass if the shape collapsed to
        // one stop, or grew extra stops, as long as none of them carried a
        // property; that is not the "present but empty" degradation this
        // motion is supposed to keep.
        expect(steps!.map((s) => s.at), `${name} reduced stops`).toEqual([0, 1])

        const props = steps!.flatMap((s) => Object.keys(s.props))
        expect(props, `${name} should declare nothing when reduced`).toEqual([])
      })
    }
  }

  it('loops only where the movement is the information', () => {
    const infinite = Object.entries(MOTIONS)
      .filter(([, s]) => s.iterations === 'infinite')
      .map(([n]) => n)
      .sort()
    expect(infinite).toEqual(['skeleton.shimmer', 'spinner.rotate'])
  })
})
