import { describe, expect, it } from 'vitest'
import { cssKeyframeName, toMotionCss } from './emitCss.js'
import { MOTIONS } from './motions.js'

const css = toMotionCss()

/**
 * Index of the `{` that closes the block opened by the `{` at `openIndex`,
 * found by counting nested braces. Pattern-matching (e.g. `lastIndexOf('}')`)
 * cannot prove containment when the outer block itself contains other
 * `{...}` blocks — it just finds *a* closing brace, not necessarily the one
 * that matches this opener.
 *
 * Deliberate copy of the identical helper in
 * `packages/tokens/src/emit/cssText.test.ts` — kept local rather than shared
 * because sharing it would mean exporting a test-only utility from
 * `@ap/tokens`'s public API.
 */
function matchingClose(source: string, openIndex: number): number {
  let depth = 0
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  throw new Error(`no matching close brace found for opener at index ${openIndex}`)
}

/** The text strictly between `openerWithBrace`'s trailing `{` and its matching `}`. */
function blockBody(openerWithBrace: string): string {
  const openIndex = css.indexOf(openerWithBrace) + openerWithBrace.length - 1
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
