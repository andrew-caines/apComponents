import { describe, expect, it } from 'vitest'
import { cssKeyframeName, toMotionCss } from './emitCss.js'

const css = toMotionCss()

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
    expect(css.slice(layerStart)).toContain('--ap-motion-error-shake:')
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
    const block = css.slice(reduced)
    for (const n of ['ap-error-shake', 'ap-enter-fade-rise', 'ap-spinner-rotate']) {
      expect(block, `${n} missing a reduced definition`).toContain(`@keyframes ${n} {`)
    }
  })

  it('degrades opacity motions to the opacity track alone', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    const face = block.slice(block.indexOf('@keyframes ap-enter-fade-rise {'))
    const body = face.slice(0, face.indexOf('\n  }'))
    expect(body).toContain('opacity: 0')
    expect(body).not.toContain('translate:')
  })

  it('degrades none-motions to a present but empty animation', () => {
    // Present, not deleted: the animation must still fire animationend so a
    // component that advances state on it behaves identically.
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    const face = block.slice(block.indexOf('@keyframes ap-error-shake {'))
    expect(face.slice(0, face.indexOf('}') + 1)).toContain('0%, 100% {')
  })

  it('is deterministic', () => {
    expect(toMotionCss()).toBe(css)
  })
})
