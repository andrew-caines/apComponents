import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DURATION, EASE } from '@ap/tokens'
import { MOTIONS } from '../motions.js'
import { toMotionVariants } from '../emitVariants.js'
import { cssKeyframeName } from '../emitCss.js'
import type { Step } from '../types.js'
import { parseMotionCss } from './parseMotionCss.js'

const css = readFileSync(join(import.meta.dirname, '../motion.css'), 'utf8')
const { normal, composites } = parseMotionCss(css)
const variants = toMotionVariants()

/** CSS declaration names → the Motion keyframe keys they correspond to. */
const cssToJs: Record<string, string[]> = {
  opacity: ['opacity'],
  scale: ['scale'],
  rotate: ['rotate'],
  height: ['height'],
  'stroke-dashoffset': ['strokeDashoffset'],
}

describe('gate: the CSS and JS emissions are equivalent', () => {
  it('covers exactly the same motion names', () => {
    expect(Object.keys(normal).sort()).toEqual(
      Object.keys(MOTIONS).map(cssKeyframeName).sort(),
    )
    expect(Object.keys(variants).sort()).toEqual(Object.keys(MOTIONS).sort())
  })

  // The composite properties are what actually bind a motion's timing to its
  // keyframes, and they are ordinary custom properties subject to the
  // cascade: a second declaration anywhere later in the sheet — after the
  // token layer, unlayered, or inside the reduced-motion block — silently
  // wins. `parseMotionCss` therefore reports every `--ap-motion-*`
  // declaration in the WHOLE file, and this counts them: exactly twelve,
  // one per motion, no duplicates and no extras. Without it, a redeclaration
  // that inverts a motion (worst case: `infinite` for reduced-motion users
  // only) is invisible to every other assertion here.
  it('declares each motion\'s composite property exactly once, and nothing else', () => {
    const expected = Object.keys(MOTIONS)
      .map((n) => `--ap-motion-${n.replace(/\./g, '-')}`)
      .sort()

    expect(
      composites.map((c) => c.property).sort(),
      'every --ap-motion-* declaration in motion.css, duplicates included',
    ).toEqual(expected)
  })

  for (const name of Object.keys(MOTIONS)) {
    const kf = cssKeyframeName(name)

    // The composite property's animation-name term is independent of the
    // property's own name: `--ap-motion-attention-nudge` naming
    // `ap-exit-fade` is valid CSS that plays the wrong animation. Nothing
    // else here can see it — every other assertion reaches the keyframes
    // through the property name.
    it(`${name}: composite drives its own keyframes, with fill-mode both`, () => {
      const parsed = normal[kf]!
      expect(parsed.name, `${name} composite animation-name`).toBe(kf)
      // `both` so the element holds the motion's first frame before it starts
      // and its last frame after it ends. Parsed rather than pattern-matched
      // at collection time, so a changed fill mode fails HERE instead of
      // throwing the misleading "has no --ap-motion-* composite property".
      expect(parsed.fill, `${name} composite fill mode`).toBe('both')
    })

    it(`${name}: step offsets agree`, () => {
      const cssAts = normal[kf]!.steps.map((s) => s.at)
      expect(cssAts).toEqual(variants[name]!.transition.times)
    })

    it(`${name}: duration and easing agree, and match the record`, () => {
      const parsed = normal[kf]!
      const spec = MOTIONS[name as keyof typeof MOTIONS]

      // parseMotionCss captures the duration/easing terms verbatim rather
      // than requiring a `var(--ap-duration-*)` / `var(--ap-ease-*)` shape at
      // collection time — that's what lets a hardcoded value (e.g. a
      // duration swapped for a literal `320ms`) parse at all instead of
      // failing collection with a misleading "no composite property" error.
      // The shape check belongs here instead, so that same perturbation
      // fails THIS assertion, naming duration or easing directly.
      const durationMatch = /^var\(--ap-duration-([a-z]+)\)$/.exec(parsed.duration)
      expect(durationMatch, `${name} duration is a var(--ap-duration-*) reference`).not.toBeNull()

      const easeMatch = /^var\(--ap-ease-([a-z-]+)\)$/.exec(parsed.ease)
      expect(easeMatch, `${name} ease is a var(--ap-ease-*) reference`).not.toBeNull()

      // Three-way: CSS token name, source record, and resolved JS value.
      expect(durationMatch![1]).toBe(spec.duration)
      expect(easeMatch![1]).toBe(spec.ease)

      const ms = Number(DURATION[spec.duration]!.replace('ms', ''))
      expect(variants[name]!.transition.duration).toBeCloseTo(ms / 1000, 6)

      // Compare the control points numerically. Comparing formatted strings
      // would fail on `0.30` vs `0.3`, which is a formatting difference and
      // not a disagreement about the curve.
      const easeValue = EASE[spec.ease]!
      const jsEase = variants[name]!.transition.ease
      if (easeValue === 'linear') {
        expect(jsEase).toBe('linear')
      } else {
        const points = /^cubic-bezier\(([^)]+)\)$/.exec(easeValue)![1]!
          .split(',')
          .map((n) => Number(n.trim()))
        expect(jsEase).toEqual(points)
      }
    })

    it(`${name}: iteration counts agree`, () => {
      const spec = MOTIONS[name as keyof typeof MOTIONS]
      const expected = spec.iterations === 'infinite' ? 'infinite' : String(spec.iterations)
      expect(normal[kf]!.iterations).toBe(expected)
      expect(variants[name]!.transition.repeat).toBe(
        spec.iterations === 'infinite' ? Infinity : spec.iterations - 1,
      )
    })

    it(`${name}: every animated property agrees value for value`, () => {
      const parsed = normal[kf]!
      const js = variants[name]!.keyframes
      const spec = MOTIONS[name as keyof typeof MOTIONS]

      // `translate` is a CSS shorthand: emitCss.ts's `declarations()` pads
      // whichever axis is undefined to a literal '0px' so the shorthand
      // always carries two values, even for a motion that only ever declares
      // one axis (e.g. error.shake never sets translateY). That padding is a
      // representational default, not a second animated axis, and the parsed
      // CSS text alone can't tell "axis declared and happens to be 0px" apart
      // from "axis never declared, defaulted to 0px" — so this asks the
      // MOTIONS record (the shared source both emitters read, not either
      // emitter's output) which axes the motion actually declares.
      const declaredAxes = new Set<string>()
      for (const step of spec.steps as readonly Step[]) {
        if (step.translateX !== undefined) declaredAxes.add('x')
        if (step.translateY !== undefined) declaredAxes.add('y')
      }

      const cssProps = new Set(parsed.steps.flatMap((s) => Object.keys(s.props)))

      // The key-set comparison below derives the JS side of `translate` from
      // `declaredAxes`, not from `cssProps` — so a `translate` declaration
      // with no axis declared anywhere in the record would silently
      // contribute nothing and go unnoticed. Assert presence directly: the
      // CSS declares `translate` if and only if the record declares at least
      // one axis.
      expect(cssProps.has('translate'), `${name} translate presence`).toBe(declaredAxes.size > 0)

      const expectedJsKeys = new Set(
        [...cssProps].flatMap((p) => (p === 'translate' ? [...declaredAxes] : cssToJs[p] ?? [p])),
      )
      expect(new Set(Object.keys(js)), `${name} property sets`).toEqual(expectedJsKeys)

      for (const [i, step] of parsed.steps.entries()) {
        for (const [prop, value] of Object.entries(step.props)) {
          if (prop === 'translate') {
            const [x, y] = value.split(/\s+/)
            if (declaredAxes.has('x')) {
              expect(String(js['x']![i]), `${name} x@${step.at}`).toBe(x)
            } else {
              expect(x, `${name} undeclared x@${step.at} should default to 0px`).toBe('0px')
            }
            if (declaredAxes.has('y')) {
              expect(String(js['y']![i]), `${name} y@${step.at}`).toBe(y)
            } else {
              expect(y, `${name} undeclared y@${step.at} should default to 0px`).toBe('0px')
            }
          } else {
            // A CSS property with no entry in `cssToJs` is a real finding —
            // emitCss.ts declares something emitVariants.ts has no counterpart
            // for. Say so; `cssToJs[prop]![0]!` would throw a bare
            // "Cannot read properties of undefined" naming nothing.
            const mapped = cssToJs[prop]
            expect(
              mapped,
              `${name}: CSS declares '${prop}', which has no entry in cssToJs — ` +
                'add its Motion keyframe key there, or stop emitting it.',
            ).toBeDefined()
            const key = mapped![0]!
            expect(String(js[key]![i]), `${name} ${prop}@${step.at}`).toBe(value)
          }
        }
      }
    })
  }
})
