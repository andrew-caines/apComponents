// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
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
