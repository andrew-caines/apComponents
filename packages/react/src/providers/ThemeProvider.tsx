'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

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
    applyScheme(scheme)
  }, [scheme])

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

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
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
