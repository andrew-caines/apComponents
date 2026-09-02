// @vitest-environment jsdom
import { render } from '@testing-library/react'
import type { CSSProperties } from 'react'
import { describe, expect, it } from 'vitest'
import { vars } from '../theme/contract.css.js'
import { ICON_PATHS, Icon, IconProvider, type IconName, type IconSize } from './index.js'

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

  // F2: the override path must carry the same aria contract as the built-in.
  // A product mapping its own icon library must not be able to ship an icon
  // with a label and no accessible name, or an unlabelled icon that is not
  // hidden from assistive technology.
  it('gives a labelled override an accessible name', () => {
    const Custom = (props: {
      className?: string
      style?: CSSProperties
      role?: string
      'aria-label'?: string
      'aria-hidden'?: boolean
      focusable?: boolean
    }) => <svg data-testid="custom" {...props} />
    const { getByTestId } = render(
      <IconProvider icons={{ check: Custom }}>
        <Icon name="check" label="Saved" />
      </IconProvider>,
    )
    const svg = getByTestId('custom')
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Saved')
    expect(svg.hasAttribute('aria-hidden')).toBe(false)
  })

  it('hides an unlabelled override from assistive technology', () => {
    const Custom = (props: {
      className?: string
      style?: CSSProperties
      role?: string
      'aria-label'?: string
      'aria-hidden'?: boolean
      focusable?: boolean
    }) => <svg data-testid="custom" {...props} />
    const { getByTestId } = render(
      <IconProvider icons={{ check: Custom }}>
        <Icon name="check" />
      </IconProvider>,
    )
    const svg = getByTestId('custom')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.hasAttribute('aria-label')).toBe(false)
    expect(svg.hasAttribute('role')).toBe(false)
  })

  // Sizing must travel as a `style` declaration, never as a `width`/`height`
  // attribute: a presentation attribute takes a length and does not resolve
  // `var()`, so `<svg width="var(--ap-icon-md)">` would be invalid. Asserting
  // `style.width`/`style.height` (not `getAttribute('width')`) is what forces
  // the CSS-declaration path specifically, rather than merely a numeric match
  // that an attribute-based implementation could also satisfy for the `size:
  // number` branch.
  describe('size', () => {
    const NAMED_SIZES: readonly IconSize[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl']

    it.each(NAMED_SIZES)('resolves named size %s to its token', (size) => {
      const { container } = render(<Icon name="check" size={size} />)
      const svg = container.querySelector('svg')!
      expect(svg.style.width).toBe(vars.icon[size])
      expect(svg.style.height).toBe(vars.icon[size])
    })

    it('accepts a number as an escape hatch, resolved to px', () => {
      const { container } = render(<Icon name="check" size={32} />)
      const svg = container.querySelector('svg')!
      expect(svg.style.width).toBe('32px')
      expect(svg.style.height).toBe('32px')
    })

    it('defaults to md when no size is given', () => {
      const { container } = render(<Icon name="check" />)
      const svg = container.querySelector('svg')!
      expect(svg.style.width).toBe(vars.icon.md)
      expect(svg.style.height).toBe(vars.icon.md)
    })

    it('passes the resolved size through to an override via style', () => {
      const Custom = (props: { style?: CSSProperties }) => <svg data-testid="custom" {...props} />
      const { getByTestId } = render(
        <IconProvider icons={{ check: Custom }}>
          <Icon name="check" size="lg" />
        </IconProvider>,
      )
      const svg = getByTestId('custom')
      expect(svg.style.width).toBe(vars.icon.lg)
      expect(svg.style.height).toBe(vars.icon.lg)
    })

    it('passes a numeric override size through to an override via style, in px', () => {
      const Custom = (props: { style?: CSSProperties }) => <svg data-testid="custom" {...props} />
      const { getByTestId } = render(
        <IconProvider icons={{ check: Custom }}>
          <Icon name="check" size={24} />
        </IconProvider>,
      )
      const svg = getByTestId('custom')
      expect(svg.style.width).toBe('24px')
      expect(svg.style.height).toBe('24px')
    })
  })
})
