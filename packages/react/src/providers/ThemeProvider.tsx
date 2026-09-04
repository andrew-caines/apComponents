'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toCssText, type Theme } from '@ap/tokens'

export type ColorScheme = 'light' | 'dark' | 'system'

export const DEFAULT_SCHEME_STORAGE_KEY = 'ap-color-scheme'

export interface ThemeContextValue {
  scheme: ColorScheme
  setScheme: (scheme: ColorScheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export interface ThemeProviderProps {
  /** Controlled scheme. When set, internal updates are ignored. */
  scheme?: ColorScheme
  /** Uncontrolled starting scheme. Defaults to `system`. */
  defaultScheme?: ColorScheme
  /** localStorage key for persisting an explicit choice. */
  storageKey?: string
  /**
   * A generated theme (`generateTheme({ brand })`). Supplying one switches this
   * provider to the RUNTIME path of ADR-0009: it emits that theme's tokens as
   * custom properties scoped to an element it renders, instead of relying on
   * the build-time `theme.css` already on the page.
   *
   * Omit it — the default — and the provider emits no CSS at all and renders no
   * element. That is the path almost every product wants: zero runtime cost, no
   * wrapper, and dark mode that works with JavaScript disabled.
   *
   * Reach for this when the palette is not knowable at build time — a per-tenant
   * brand colour read from the request. Nesting works through the cascade, so a
   * panel themed differently from its page is just a nested provider.
   */
  theme?: Theme
  children: ReactNode
}

/**
 * Owns the colour-scheme choice and reflects an explicit one onto `<html>`.
 *
 * It emits NO CSS. `theme.css` already carries the three-state cascade:
 * `:root` for light, `[data-ap-scheme="dark"]` for an explicit dark choice, and
 * `@media (prefers-color-scheme: dark) :root:not([data-ap-scheme="light"])` for
 * `system`. So `system` is expressed by the ABSENCE of the attribute, which is
 * what lets dark mode work with JavaScript disabled (ADR-0009).
 */
export function ThemeProvider({
  scheme: controlled,
  defaultScheme = 'system',
  storageKey = DEFAULT_SCHEME_STORAGE_KEY,
  theme,
  children,
}: ThemeProviderProps) {
  const [uncontrolled, setUncontrolled] = useState<ColorScheme>(defaultScheme)
  const scheme = controlled ?? uncontrolled

  // Read persisted choice AFTER hydration, never during render (ADR-0005).
  // A controlled provider owns the value, so storage must not override it.
  useEffect(() => {
    if (controlled !== undefined) return
    const stored = readStoredScheme(storageKey)
    if (stored) setUncontrolled(stored)
  }, [controlled, storageKey])

  useEffect(() => {
    // Only the unscoped provider owns `<html>`. A scoped one renders the
    // attribute on its own element instead (see `ScopedTheme`), so writing here
    // as well would leak a nested subtree's scheme to the entire page.
    if (theme !== undefined) return
    applyScheme(scheme)
  }, [scheme, theme])

  const setScheme = useCallback(
    (next: ColorScheme) => {
      // A controlled provider does not own the value: it must neither apply
      // NOR persist it. Persisting anyway would plant a ghost choice in
      // storage that the read-after-hydration effect resurrects the moment
      // this provider is later rendered uncontrolled — a value the user
      // never actually selected through this instance.
      if (controlled === undefined) {
        persistScheme(storageKey, next)
        setUncontrolled(next)
      }
    },
    [controlled, storageKey],
  )

  const value = useMemo<ThemeContextValue>(() => ({ scheme, setScheme }), [scheme, setScheme])

  return (
    <ThemeContext.Provider value={value}>
      {theme === undefined ? children : <ScopedTheme theme={theme} scheme={scheme}>{children}</ScopedTheme>}
    </ThemeContext.Provider>
  )
}

/**
 * The runtime path. Rendered only when a `theme` is supplied.
 *
 * Split into its own component so the default path calls one fewer hook and
 * renders one fewer element — the common case pays nothing for this.
 */
function ScopedTheme({
  theme,
  scheme,
  children,
}: {
  theme: Theme
  scheme: ColorScheme
  children: ReactNode
}) {
  // `useId` rather than a counter or a random value: it is stable across the
  // server render and the client hydration, which a counter in module scope is
  // not (the module is fresh per request on the server, shared on the client)
  // and a random value can never be. A mismatched scope class would mean the
  // server sent CSS targeting one name and the client asked for another —
  // tokens silently falling back to the build-time defaults after hydration.
  //
  // React's ids contain punctuation that is not valid in a class name, so they
  // are stripped rather than escaped; the id only has to be unique, not legible.
  const scope = `ap-t-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  // `toCssText`'s `selector` option rewrites every `:root` in the sheet, and
  // deliberately expects `data-ap-scheme` ON the scoped element rather than on
  // an ancestor — which is what makes nesting work and what this component has
  // to honour below.
  const css = useMemo(() => toCssText(theme, { selector: `.${scope}` }), [theme, scope])

  return (
    <>
      {/*
        A plain <style>, rendered in place, not injected from an effect. The
        tokens are then in the SERVER response, so a per-tenant palette paints
        correctly on first paint with no flash and nothing to hydrate. An
        effect-injected stylesheet would repaint after hydration, which is the
        exact failure ADR-0009 exists to avoid.
      */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {/*
        `display: contents` so the scoping element generates no box and cannot
        disturb the layout it wraps. Custom properties inherit through the DOM
        tree rather than the box tree, so the tokens still reach every
        descendant. A plain <div> carries no role, so removing its box removes
        nothing from the accessibility tree either.

        `data-ap-scheme` goes HERE, not on <html>: a scoped provider that wrote
        the global attribute would re-theme the whole page from inside a nested
        subtree, which is the gap Phase 4a recorded and this closes. Rendered as
        an attribute rather than applied in an effect, so it is correct in the
        server HTML too.
      */}
      <div
        className={scope}
        style={{ display: 'contents' }}
        {...(scheme === 'system' ? {} : { 'data-ap-scheme': scheme })}
      >
        {children}
      </div>
    </>
  )
}

function persistScheme(key: string, scheme: ColorScheme): void {
  try {
    if (scheme === 'system') localStorage.removeItem(key)
    else localStorage.setItem(key, scheme)
  } catch {
    // Private mode, blocked storage, or none at all. The choice still applies
    // to this page; only persistence is lost.
  }
}

function readStoredScheme(key: string): ColorScheme | null {
  try {
    const v = localStorage.getItem(key)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function applyScheme(scheme: ColorScheme): void {
  const el = document.documentElement
  // `system` removes the attribute so the media query decides. Setting
  // data-ap-scheme="system" would match neither selector and silently break.
  if (scheme === 'system') el.removeAttribute('data-ap-scheme')
  else el.setAttribute('data-ap-scheme', scheme)
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider> (or <ApProvider>).')
  }
  return ctx
}

export function useColorScheme(): [ColorScheme, (scheme: ColorScheme) => void] {
  const { scheme, setScheme } = useTheme()
  return [scheme, setScheme]
}
