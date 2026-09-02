import { describe, expect, it } from 'vitest'
import { cssKeyframeName, toMotionCss } from './emitCss.js'
import { MOTIONS } from './motions.js'
import { matchingClose } from './gates/parseMotionCss.js'

const css = toMotionCss()

/** The text strictly between `openerWithBrace`'s trailing `{` and its matching `}`. */
function blockBody(openerWithBrace: string): string {
  const found = css.indexOf(openerWithBrace)
  // Without this guard a missing opener yields a bogus index rather than an
  // error, and matchingClose only *sometimes* throws from there — given a
  // coincidental `{...}` pair downstream it returns a wrong span silently,
  // which is the exact failure this helper exists to rule out.
  if (found === -1) throw new Error(`block opener not found in emitted CSS: ${openerWithBrace}`)
  const openIndex = found + openerWithBrace.length - 1
  const closeIndex = matchingClose(css, openIndex)
  return css.slice(openIndex + 1, closeIndex)
}

const layerBody = blockBody('@layer ap.tokens {')
const reducedBody = blockBody('@media (prefers-reduced-motion: reduce) {')

describe('toMotionCss', () => {
  it('turns a dotted motion name into a hyphenated keyframe name', () => {
    expect(cssKeyframeName('error.shake')).toBe('ap-error-shake')
    expect(cssKeyframeName('collapse')).toBe('ap-collapse')
  })

  it('emits a keyframes block for every motion', () => {
    expect(css).toContain('@keyframes ap-error-shake {')
    expect(css).toContain('@keyframes ap-spinner-rotate {')
    expect((css.match(/^@keyframes /gm) ?? []).length).toBe(12)
  })

  it('emits keyframes unlayered and composite properties inside the token layer', () => {
    // Exactly one layer block, because `layerBody` (and every reader like it)
    // inspects the FIRST one. A second `@layer ap.tokens` block later in the
    // sheet would win the cascade and go entirely unexamined.
    expect(css.match(/@layer ap\.tokens \{/g), 'exactly one ap.tokens layer block').toHaveLength(1)
    const layerStart = css.indexOf('@layer ap.tokens {')
    expect(layerStart).toBeGreaterThan(css.indexOf('@keyframes ap-error-shake'))
    expect(layerBody).toContain('--ap-motion-error-shake:')
    expect(layerBody).not.toContain('@keyframes')
  })

  it('references duration and easing as custom properties, never as values', () => {
    expect(css).toContain(
      '--ap-motion-error-shake: ap-error-shake var(--ap-duration-slow) var(--ap-ease-in-out) 1 both;',
    )
    expect(css).not.toMatch(/--ap-motion-[a-z-]+:[^;]*\d+ms/)
    expect(css).not.toMatch(/--ap-motion-[a-z-]+:[^;]*cubic-bezier/)
  })

  it('emits infinite only where the record says so', () => {
    expect(css).toContain(
      '--ap-motion-spinner-rotate: ap-spinner-rotate var(--ap-duration-slower) var(--ap-ease-linear) infinite both;',
    )
    expect(css).toContain('--ap-motion-warning-pulse: ap-warning-pulse var(--ap-duration-slow) var(--ap-ease-in-out) 2 both;')
  })

  it('writes offsets as trimmed percentages', () => {
    expect(css).toContain('  0% {')
    expect(css).toContain('  100% {')
    expect(css).toContain('16.7% {')
  })

  it('composes translate as a single property from X and Y', () => {
    expect(css).toContain('translate: -4px 0px')
    expect(css).toContain('translate: 0px 8px')
  })

  it('re-declares every motion under prefers-reduced-motion, after the originals', () => {
    const reduced = css.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(reduced).toBeGreaterThan(css.indexOf('@keyframes ap-error-shake'))
    for (const n of Object.keys(MOTIONS)) {
      const kf = cssKeyframeName(n)
      expect(reducedBody, `${kf} missing a reduced definition`).toContain(`@keyframes ${kf} {`)
    }
    // The reduced block re-declares KEYFRAMES only. A composite property in
    // here is unlayered and inside a matching media query, so it beats the
    // layered declaration for reduced-motion users alone — inverting the
    // guarantee this block exists to make.
    expect(reducedBody, 'no composite properties inside the reduced-motion block')
      .not.toContain('--ap-motion-')
  })

  it('degrades opacity motions to the opacity track alone', () => {
    const face = reducedBody.slice(reducedBody.indexOf('@keyframes ap-enter-fade-rise {'))
    const body = face.slice(0, face.indexOf('\n  }'))
    expect(body).toContain('opacity: 0')
    expect(body).not.toContain('translate:')
  })

  it('degrades none-motions to a present but empty animation', () => {
    // Present, not deleted: the animation must still fire animationend so a
    // component that advances state on it behaves identically.
    const face = reducedBody.slice(reducedBody.indexOf('@keyframes ap-error-shake {'))
    expect(face.slice(0, face.indexOf('}') + 1)).toContain('0%, 100% {')
  })

  it('is deterministic', () => {
    expect(toMotionCss()).toBe(css)
  })
})
