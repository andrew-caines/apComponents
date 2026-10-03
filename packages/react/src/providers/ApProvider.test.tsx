// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApProvider } from './ApProvider.js'
import { useLocale, useMessages } from './LocaleProvider.js'
import { DEFAULT_SCHEME_STORAGE_KEY, useColorScheme } from './ThemeProvider.js'
import { Icon } from '../icons/index.js'
import { Tooltip } from '../components/Tooltip/Tooltip.js'

function Probe() {
  const [scheme] = useColorScheme()
  const { locale } = useLocale()
  return <span data-testid="v">{`${scheme}|${locale}`}</span>
}

function SchemeButton() {
  const [scheme, setScheme] = useColorScheme()
  return (
    <button onClick={() => setScheme('dark')} data-testid="scheme-btn">
      {scheme}
    </button>
  )
}

function LocaleProbe() {
  const { timeZone, currency } = useLocale()
  const m = useMessages()
  return <span data-testid="locale-v">{`${timeZone}|${currency}|${m.close}`}</span>
}

function TwoTooltips() {
  return (
    <>
      <Tooltip content="First tip">
        <button type="button">First</button>
      </Tooltip>
      <Tooltip content="Second tip">
        <button type="button">Second</button>
      </Tooltip>
    </>
  )
}

/** Hover opens after the delay; leaving the first and entering the second is the grouped move. */
async function hoverFirstThenSecond() {
  const first = screen.getByRole('button', { name: 'First' })
  const second = screen.getByRole('button', { name: 'Second' })
  fireEvent.mouseEnter(first)
  fireEvent.mouseMove(first)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(650)
  })
  expect(screen.queryByText('First tip')).not.toBeNull()
  fireEvent.mouseLeave(first)
  fireEvent.mouseEnter(second)
  fireEvent.mouseMove(second)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

afterEach(() => {
  vi.useRealTimers()
  // Mirrors ThemeProvider.test.tsx: the scheme click test writes state
  // outside React's tree (the <html> attribute and localStorage) that no
  // unmount reverses.
  document.documentElement.removeAttribute('data-ap-scheme')
  localStorage.clear()
})

describe('ApProvider', () => {
  it('supplies theme and locale in one component', () => {
    // A non-default `scheme` alongside a non-default `locale`: both hooks
    // throw by name with no provider, so a "no providers at all" bypass is
    // already ruled out — but 'system'/'en-US' are ALSO the library's
    // defaults, so a bug that wired the providers yet silently dropped both
    // props (e.g. rendered `<ThemeProvider><LocaleProvider>` with the props
    // never spread through) would satisfy the all-defaults version of this
    // assertion identically to a correct implementation. Asserting values
    // that differ from the defaults on both axes means the result can only
    // come from ApProvider actually forwarding what it was given.
    render(
      <ApProvider scheme="dark" locale="fr-FR">
        <Probe />
      </ApProvider>,
    )
    expect(screen.getByTestId('v').textContent).toBe('dark|fr-FR')
  })

  it('passes icon overrides through', () => {
    const Custom = () => <svg data-testid="custom" />
    const { container } = render(
      <ApProvider icons={{ check: Custom }}>
        <Icon name="check" />
      </ApProvider>,
    )
    expect(container.querySelector('[data-testid="custom"]')).toBeTruthy()
    // Distinguishes "the override reached IconProvider" from "the built-in
    // happened to render alongside it": the built-in Icon draws a <path>
    // inside its <svg>, which Custom never does, and exactly one <svg>
    // should exist. A bug that dropped `icons` on the floor (IconProvider
    // sees `{}`, Icon falls through to its built-in) would still pass the
    // line above only if Custom's own output were mistaken for the
    // built-in's — checking there is no <path> and only one <svg> in the
    // tree rules that out.
    expect(container.querySelectorAll('svg')).toHaveLength(1)
    expect(container.querySelector('path')).toBeFalsy()
  })

  it('needs no props at all', () => {
    render(
      <ApProvider>
        <Probe />
      </ApProvider>,
    )
    expect(screen.getByTestId('v').textContent).toBe('system|en-US')
  })

  // F10: 5 of ApProvider's 8 conditional spreads (defaultScheme, storageKey,
  // timeZone, currency, messages) had no coverage at all. All eight forward
  // correctly today, so this is a coverage gap rather than a live bug — but a
  // dropped spread (e.g. `{...(x !== undefined ? { x } : {})}` silently
  // deleted in a refactor) would be invisible without an assertion that only
  // a correctly-forwarded prop can satisfy.

  it('forwards defaultScheme to ThemeProvider as the uncontrolled starting scheme', () => {
    render(
      <ApProvider defaultScheme="dark">
        <Probe />
      </ApProvider>,
    )
    expect(screen.getByTestId('v').textContent).toBe('dark|en-US')
  })

  it('forwards storageKey to ThemeProvider, so an explicit choice persists under that key', async () => {
    render(
      <ApProvider storageKey="custom-scheme-key">
        <SchemeButton />
      </ApProvider>,
    )
    await act(async () => {
      screen.getByTestId('scheme-btn').click()
    })
    // Persisted under the CUSTOM key, and not under the library default —
    // proves storageKey reached ThemeProvider rather than being dropped
    // (which would leave the choice under the default key instead).
    expect(localStorage.getItem('custom-scheme-key')).toBe('dark')
    expect(localStorage.getItem(DEFAULT_SCHEME_STORAGE_KEY)).toBeNull()
  })

  it('forwards timeZone and currency to LocaleProvider', () => {
    render(
      <ApProvider timeZone="Europe/Paris" currency="EUR">
        <LocaleProbe />
      </ApProvider>,
    )
    expect(screen.getByTestId('locale-v').textContent).toBe('Europe/Paris|EUR|Close')
  })

  it('forwards messages to LocaleProvider, overriding the default registry', () => {
    render(
      <ApProvider messages={{ close: 'Fermer' }}>
        <LocaleProbe />
      </ApProvider>,
    )
    expect(screen.getByTestId('locale-v').textContent).toBe('undefined|USD|Fermer')
  })

  // Fails if ApProvider stops wrapping its tree in the tooltip provider: the
  // second tooltip then waits its own full delay.
  it('groups tooltip delays across the app', async () => {
    vi.useFakeTimers()
    render(
      <ApProvider>
        <TwoTooltips />
      </ApProvider>,
    )
    await hoverFirstThenSecond()
    expect(screen.queryByText('Second tip')).not.toBeNull()
  })

  // The control: with no provider the same sequence needs the full delay.
  it('needs the full delay for the second tooltip without ApProvider', async () => {
    vi.useFakeTimers()
    render(<TwoTooltips />)
    await hoverFirstThenSecond()
    expect(screen.queryByText('Second tip')).toBeNull()
  })
})
