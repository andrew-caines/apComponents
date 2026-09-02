// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApProvider } from './ApProvider.js'
import { useLocale } from './LocaleProvider.js'
import { useColorScheme } from './ThemeProvider.js'
import { Icon } from '../icons/index.js'

function Probe() {
  const [scheme] = useColorScheme()
  const { locale } = useLocale()
  return <span data-testid="v">{`${scheme}|${locale}`}</span>
}

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
})
