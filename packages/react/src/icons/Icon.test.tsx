// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ICON_PATHS, Icon, IconProvider, type IconName } from './index.js'

describe('Icon', () => {
  it('is decorative by default, so a screen reader skips it', () => {
    const { container } = render(<Icon name="check" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.hasAttribute('aria-label')).toBe(false)
  })

  it('becomes meaningful when given a label', () => {
    const { container } = render(<Icon name="check" label="Saved" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Saved')
    expect(svg.hasAttribute('aria-hidden')).toBe(false)
  })

  // Strengthened beyond the brief: rendering in a loop and asserting an <svg>
  // exists proves little, because Icon always renders an <svg> SHELL even if
  // the name-to-path lookup is broken (e.g. ICON_PATHS[name] resolves to
  // undefined and the <path d> ends up empty or missing). Asserting the
  // rendered path's `d` attribute matches ICON_PATHS[name] exactly forces the
  // lookup itself to be correct for every name, not just present.
  //
  // Perturbation that breaks this but NOT the original "an <svg> exists"
  // assertion: change `ICON_PATHS[name]` in Icon.tsx to `ICON_PATHS.check`
  // (always render the check glyph). Every name still renders a non-empty
  // <svg><path d="..."/></svg>, so the original test stays green; this one
  // fails for every name other than 'check' because the path data no longer
  // matches what that name is supposed to draw.
  it('renders every name in the set with the correct path data', () => {
    const names: readonly IconName[] = ['check', 'close', 'chevron-down', 'alert-circle', 'info']
    for (const name of names) {
      const { container } = render(<Icon name={name} />)
      const path = container.querySelector('svg path')
      expect(path, `${name} rendered no <path>`).toBeTruthy()
      const d = path!.getAttribute('d')
      expect(d, `${name} has no path data`).toBeTruthy()
      expect(d, `${name} rendered the wrong path data`).toBe(ICON_PATHS[name])
    }
  })

  it('lets a product swap one icon globally through IconProvider', () => {
    const Custom = () => <svg data-testid="custom" />
    const { container } = render(
      <IconProvider icons={{ check: Custom }}>
        <Icon name="check" />
      </IconProvider>,
    )
    expect(container.querySelector('[data-testid="custom"]')).toBeTruthy()
  })

  // Strengthened beyond the brief: the original test only rendered <Icon
  // name="close" /> under a provider that overrides "check", and asserted no
  // custom node and an <svg> exists. That passes just as well if overrides
  // are never wired up at all (Icon always ignores useIconOverrides() and
  // always renders the built-in) — there is nothing here that only a WORKING
  // override mechanism would satisfy. Rendering both the overridden name and
  // the un-overridden name from the SAME provider in one test closes that
  // gap: if overrides are broken/ignored, "check" would fail to show the
  // custom node; if overrides are applied indiscriminately (e.g. any lookup
  // returns the first configured override regardless of key), "close" would
  // wrongly render the custom node too. Only a correct, name-keyed lookup
  // satisfies both halves at once.
  //
  // Perturbation that breaks this but NOT the original brief test: change the
  // override lookup in Icon.tsx from `useIconOverrides()[name]` to
  // `Object.values(useIconOverrides())[0]` (grab whatever was configured,
  // ignoring the key). The original "falls back" test above only ever passed
  // a single-entry overrides map for a DIFFERENT name than the one rendered,
  // so nothing in it distinguishes "looked up by name" from "grabbed
  // whatever's configured" — this version does, because it renders the
  // overridden name in the same provider and would wrongly get the custom
  // component for "close" too.
  it('falls back to the built-in for names the product did not override, while the override still applies where it matches', () => {
    const Custom = () => <svg data-testid="custom" />
    const { container } = render(
      <IconProvider icons={{ check: Custom }}>
        <>
          <Icon name="check" />
          <Icon name="close" />
        </>
      </IconProvider>,
    )
    const customNodes = container.querySelectorAll('[data-testid="custom"]')
    expect(customNodes.length, 'expected exactly one overridden icon (check)').toBe(1)

    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBe(2)
    const builtInPath = container.querySelector('svg:not([data-testid="custom"]) path')
    expect(builtInPath, 'expected the un-overridden icon to render the built-in <path>').toBeTruthy()
    expect(builtInPath!.getAttribute('d'), 'expected the built-in "close" glyph, not a stray shell').toBe(
      ICON_PATHS.close,
    )
  })

  it('works with no IconProvider at all', () => {
    const { container } = render(<Icon name="info" />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
