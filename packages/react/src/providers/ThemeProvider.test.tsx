// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { generateTheme, toCssText } from '@ap/tokens'
import { ThemeProvider, useColorScheme } from './ThemeProvider.js'

function Probe() {
  const [scheme, setScheme] = useColorScheme()
  return (
    <button onClick={() => setScheme('dark')} data-testid="b">
      {scheme}
    </button>
  )
}

afterEach(() => {
  // Unmounting is handled globally by vitest.setup.ts. What is left here is
  // the state this suite writes OUTSIDE React's tree — the attribute on
  // <html> and the persisted choice — which no unmount reverses and which
  // would otherwise leak into the next test.
  document.documentElement.removeAttribute('data-ap-scheme')
  localStorage.clear()
})

describe('ThemeProvider', () => {
  it('defaults to system, which sets no attribute so pure CSS decides', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('b').textContent).toBe('system')
    expect(document.documentElement.hasAttribute('data-ap-scheme')).toBe(false)
  })

  it('reflects an explicit choice onto <html>, which wins the cascade', async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    await act(async () => {
      screen.getByTestId('b').click()
    })
    expect(document.documentElement.getAttribute('data-ap-scheme')).toBe('dark')
  })

  it('is controllable, and a controlled provider ignores internal setState', async () => {
    render(
      <ThemeProvider scheme="light">
        <Probe />
      </ThemeProvider>,
    )
    await act(async () => {
      screen.getByTestId('b').click()
    })
    expect(screen.getByTestId('b').textContent).toBe('light')
    expect(document.documentElement.getAttribute('data-ap-scheme')).toBe('light')
  })

  it('restores a persisted choice after hydration, not during render', async () => {
    localStorage.setItem('ap-color-scheme', 'dark')
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    // The value arrives via an effect, so the FIRST render still said `system`
    // and matched what a server would have produced. That the effect then
    // corrects it is the whole point of the two-pass rule (ADR-0005).
    expect(await screen.findByText('dark')).toBeTruthy()
  })

  it('throws by name when useColorScheme is used with no provider', () => {
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/)
  })

  // F1: a controlled provider does not own the scheme, so an internal
  // setScheme() call must be a complete no-op — it must not apply the value
  // AND it must not persist it either. Persisting anyway plants a ghost
  // choice in storage: the moment the app later renders this provider
  // uncontrolled, the read-after-hydration effect resurrects a value the
  // user never actually selected through this instance.
  it('does not persist a scheme change it was not allowed to apply', async () => {
    render(
      <ThemeProvider scheme="light">
        <Probe />
      </ThemeProvider>,
    )
    await act(async () => {
      screen.getByTestId('b').click()
    })
    expect(localStorage.getItem('ap-color-scheme')).toBeNull()
  })
})

describe('ThemeProvider runtime override (ADR-0009)', () => {
  const tenant = generateTheme({ brand: '#c2185b' })

  it('emits nothing and wraps nothing without a theme', () => {
    const { container } = render(
      <ThemeProvider>
        <span data-testid="child">x</span>
      </ThemeProvider>,
    )
    expect(container.querySelector('style')).toBeNull()
    // The child is a direct child — no scoping element was introduced. This is
    // what "the default path costs nothing" actually means, and it is the half
    // that would rot silently if only the runtime path were tested.
    expect(container.firstElementChild?.getAttribute('data-testid')).toBe('child')
  })

  it('emits the theme scoped to a class the child actually carries', () => {
    const { container } = render(
      <ThemeProvider theme={tenant}>
        <span data-testid="child">x</span>
      </ThemeProvider>,
    )
    const style = container.querySelector('style')
    expect(style).not.toBeNull()

    const scoped = container.querySelector('div[class^="ap-t-"]')
    expect(scoped).not.toBeNull()
    const scope = scoped!.className

    // The two halves have to agree. A stylesheet scoped to `.ap-t-a` beside an
    // element classed `ap-t-b` produces no error and no styling — the tokens
    // just silently stay at their build-time defaults.
    // A word-boundary match, not `toContain`. `toContain('.ap-t-a')` is a
    // substring test and passes happily against a stylesheet scoped to
    // `.ap-t-ab` — which is exactly the near-miss this assertion exists to
    // catch, and it did not catch it until this was tightened.
    expect(style!.textContent).toMatch(new RegExp(`\.${scope}(?![a-zA-Z0-9_-])`))
    expect(style!.textContent).not.toContain(':root')
    expect(scoped!.contains(screen.getByTestId('child'))).toBe(true)
  })

  it('emits this tenant’s brand, not the default one', () => {
    const { container } = render(
      <ThemeProvider theme={tenant}>
        <span>x</span>
      </ThemeProvider>,
    )
    const css = container.querySelector('style')!.textContent ?? ''
    const mine = toCssText(tenant, { selector: '.x' })
    // Pull brand-9 out of both and compare. Asserting merely that
    // `--ap-brand-9` appears would pass for any theme at all, including the
    // default one the page already has — which is the whole thing this feature
    // exists to override.
    const brand9 = (text: string) => /--ap-brand-9:\s*([^;]+);/.exec(text)?.[1]?.trim()
    expect(brand9(css)).toBe(brand9(mine))
    expect(brand9(css)).not.toBe(brand9(toCssText(generateTheme({ brand: '#2e5fd9' }), {})))
  })

  it('scopes the colour scheme to its own element rather than <html>', () => {
    document.documentElement.removeAttribute('data-ap-scheme')
    const { container } = render(
      <ThemeProvider theme={tenant} scheme="dark">
        <span>x</span>
      </ThemeProvider>,
    )
    const scoped = container.querySelector('div[class^="ap-t-"]')!
    expect(scoped.getAttribute('data-ap-scheme')).toBe('dark')
    // The gap Phase 4a recorded: a scoped provider that also wrote the global
    // attribute would re-theme the entire page from inside a nested subtree.
    expect(document.documentElement.hasAttribute('data-ap-scheme')).toBe(false)
  })

  it('leaves the attribute off entirely for `system`, so the media query decides', () => {
    const { container } = render(
      <ThemeProvider theme={tenant} scheme="system">
        <span>x</span>
      </ThemeProvider>,
    )
    const scoped = container.querySelector('div[class^="ap-t-"]')!
    // `data-ap-scheme="system"` would match neither generated selector and
    // silently pin the subtree to light.
    expect(scoped.hasAttribute('data-ap-scheme')).toBe(false)
  })

  it('gives nested providers different scopes, so the inner one can win', () => {
    const inner = generateTheme({ brand: '#00897b' })
    const { container } = render(
      <ThemeProvider theme={tenant}>
        <ThemeProvider theme={inner}>
          <span data-testid="deep">x</span>
        </ThemeProvider>
      </ThemeProvider>,
    )
    const scopes = [...container.querySelectorAll('div[class^="ap-t-"]')].map((el) => el.className)
    expect(scopes).toHaveLength(2)
    expect(new Set(scopes).size, 'nested providers collided on one scope class').toBe(2)
    // Which one actually wins is a cascade question a DOM stub cannot answer;
    // `fixtures/ssr-app/e2e/theme.spec.ts` resolves it with getComputedStyle in
    // a real browser.
    const deep = screen.getByTestId('deep')
    expect(deep.closest(`.${scopes[1]}`)).not.toBeNull()
    expect(deep.closest(`.${scopes[0]}`)).not.toBeNull()
  })
})
