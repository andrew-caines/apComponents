import { describe, expect, it } from 'vitest'
import { parseMotionCss } from './parseMotionCss.js'

// Direct tests of the extractor itself, driven by small hand-written CSS
// strings — not the real committed artifact. The equivalence gate exercises
// the happy path implicitly (via motion.css); this file covers the guards
// and helpers that the happy path never has reason to hit.

describe('parseMotionCss: guards', () => {
  it('throws when the reduced-motion media query is absent entirely', () => {
    const css = '@keyframes ap-foo {\n  0% { opacity: 0; }\n}\n'
    expect(() => parseMotionCss(css)).toThrow(/no prefers-reduced-motion block/)
  })

  it('throws when the opener has no opening brace anywhere after it', () => {
    const css = '@media (prefers-reduced-motion: reduce)'
    expect(() => parseMotionCss(css)).toThrow(/no opening brace/)
  })

  it('throws when a brace after the opener belongs to something else', () => {
    // No brace of its own follows the opener; the next `{` in the file
    // belongs to an unrelated @keyframes rule. Silently slicing from that
    // brace would mis-slice the unrelated rule in as the reduced body.
    const css = [
      '@media (prefers-reduced-motion: reduce) screen',
      '@keyframes ap-other {',
      '  0% { opacity: 0; }',
      '}',
      '',
    ].join('\n')
    expect(() => parseMotionCss(css)).toThrow(
      /opener is not immediately followed by its opening brace/,
    )
  })

  it('throws when the reduced-motion block never closes', () => {
    const css = '@media (prefers-reduced-motion: reduce) { @keyframes ap-foo { 0% { opacity: 0; } '
    expect(() => parseMotionCss(css)).toThrow(/no matching close brace/)
  })
})

describe('parseMotionCss: percentToUnit', () => {
  it('rounds a repeating-decimal percent to an exact unit, not a float artifact', () => {
    const css = [
      '@media (prefers-reduced-motion: reduce) {',
      '  @keyframes ap-foo {',
      '    16.7% { opacity: 0.5; }',
      '  }',
      '}',
      '',
    ].join('\n')
    const { reduced } = parseMotionCss(css)
    // Plain `Number('16.7') / 100` lands on 0.16699999999999998.
    expect(reduced['ap-foo']![0]!.at).toBe(0.167)
  })

  it('parses a two-offset stop (`0%, 100% { }`) as two identical steps', () => {
    const css = [
      '@media (prefers-reduced-motion: reduce) {',
      '  @keyframes ap-foo {',
      '    0%, 100% { }',
      '  }',
      '}',
      '',
    ].join('\n')
    const { reduced } = parseMotionCss(css)
    expect(reduced['ap-foo']!.map((s) => s.at)).toEqual([0, 1])
  })
})

describe('parseMotionCss: reduced-block slicing', () => {
  it('does not leak content after the reduced block into `reduced`', () => {
    const css = [
      '@media (prefers-reduced-motion: reduce) {',
      '  @keyframes ap-foo {',
      '    0%, 100% { }',
      '  }',
      '}',
      '@keyframes ap-should-not-appear {',
      '  0% { opacity: 0; }',
      '}',
      '',
    ].join('\n')
    const { reduced } = parseMotionCss(css)
    expect(reduced['ap-foo']).toBeDefined()
    expect(reduced['ap-should-not-appear']).toBeUndefined()
  })
})

describe('parseMotionCss: composite declarations', () => {
  const composite = (
    property: string,
    name: string,
    { iterations = '1', fill = 'both' }: { iterations?: string; fill?: string } = {},
  ): string =>
    `    ${property}: ${name} var(--ap-duration-slow) var(--ap-ease-in-out) ${iterations} ${fill};`

  const sheet = (...declarations: string[]): string =>
    [
      '@keyframes ap-foo {',
      '  0% { opacity: 0; }',
      '  100% { opacity: 1; }',
      '}',
      '',
      '@layer ap.tokens {',
      '  :root {',
      ...declarations,
      '  }',
      '}',
      '',
      '@media (prefers-reduced-motion: reduce) {',
      '  @keyframes ap-foo {',
      '    0%, 100% { }',
      '  }',
      '}',
      '',
    ].join('\n')

  it('captures the animation-name and fill-mode terms, not only the property name', () => {
    // The property says `foo`; the animation name points at other keyframes
    // entirely. Keying only by property makes that invisible, so both terms
    // are carried and the gate compares them.
    const { composites } = parseMotionCss(sheet(composite('--ap-motion-foo', 'ap-elsewhere')))
    expect(composites).toHaveLength(1)
    expect(composites[0]!.property).toBe('--ap-motion-foo')
    expect(composites[0]!.key).toBe('ap-foo')
    expect(composites[0]!.name).toBe('ap-elsewhere')
    expect(composites[0]!.fill).toBe('both')
  })

  it('parses a non-`both` fill mode instead of failing collection', () => {
    // Hardcoding `both;` in the pattern makes a changed fill mode throw the
    // misleading "@keyframes ... has no --ap-motion-* composite property".
    const { composites } = parseMotionCss(
      sheet(composite('--ap-motion-foo', 'ap-foo', { fill: 'forwards' })),
    )
    expect(composites[0]!.fill).toBe('forwards')
  })

  it('reports a redeclaration that wins the cascade, wherever in the sheet it sits', () => {
    const css = [
      sheet(composite('--ap-motion-foo', 'ap-foo')),
      '@layer ap.tokens {',
      '  :root {',
      composite('--ap-motion-foo', 'ap-elsewhere'),
      '  }',
      '}',
      '',
    ].join('\n')
    const { composites } = parseMotionCss(css)
    expect(composites.map((c) => c.name)).toEqual(['ap-foo', 'ap-elsewhere'])
  })

  it('reports a composite hiding inside the reduced-motion block', () => {
    // The worst case: unlayered, inside the media block, so it beats the
    // layered declaration for reduced-motion users only.
    const css = [
      '@keyframes ap-foo {',
      '  0% { opacity: 0; }',
      '}',
      '',
      '@layer ap.tokens {',
      '  :root {',
      composite('--ap-motion-foo', 'ap-foo'),
      '  }',
      '}',
      '',
      '@media (prefers-reduced-motion: reduce) {',
      '  :root {',
      composite('--ap-motion-foo', 'ap-foo', { iterations: 'infinite' }),
      '  }',
      '  @keyframes ap-foo {',
      '    0%, 100% { }',
      '  }',
      '}',
      '',
    ].join('\n')
    const { composites } = parseMotionCss(css)
    expect(composites).toHaveLength(2)
    expect(composites[1]!.iterations).toBe('infinite')
  })
})
