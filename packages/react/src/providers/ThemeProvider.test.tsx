// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
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
  // This suite has no `globals: true` / setupFiles, so
  // @testing-library/react's auto-cleanup-after-each never registers (it
  // detects a global test framework, and vitest here is used un-global).
  // Every Probe renders the same data-testid, so without an explicit
  // unmount the second test's query finds this test's leftover button too.
  cleanup()
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
})
