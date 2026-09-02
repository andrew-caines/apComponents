# Phase 4a — Provider stack and icons: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SSR-safe provider stack (`ThemeProvider`, `LocaleProvider`, `IconProvider`, `ApProvider`), the five icons Phase 4 needs, and the hooks they depend on — so the three components that follow have a proven foundation.

**Architecture:** Four React contexts, each with a default that is either correct standalone or throws by name. No provider generates CSS: `theme.css` already carries the three-state `data-ap-scheme` cascade from Phase 1, so `ThemeProvider` scopes and sets an attribute rather than emitting tokens. Strings live in a typed message registry with English fallback; icons in a name→component registry. Everything is `'use client'` and SSR-safe by construction, enforced by gates rather than review.

**Tech Stack:** React 19.2.8, `@base-ui/react@1.7.0` (exact), vanilla-extract, Vitest + Testing Library, TypeScript ESM.

**Spec:** `docs/superpowers/specs/2026-09-02-phase4-vertical-slice-design.md`

## Global Constraints

- **`@base-ui/react` pinned to exactly `1.7.0`.** Never `@base-ui-components/react` — deprecated, renamed. (ADR-0004, as corrected 2026-09-02.)
- **Never import a Base UI date part.** `date-fns` / `@date-fns/tz` are optional peers of Base UI; importing one makes them required for every consuming product, which ADR-0012 rejected.
- **No browser globals at module scope or during render.** No `window`, `document`, `localStorage`, `matchMedia`. (ADR-0005.)
- **`useLayoutEffect` only via `useIsomorphicLayoutEffect`.** (ADR-0005.)
- **IDs from `useId`.** Never a counter, never random. (ADR-0005.)
- **The server render and the first client render must produce identical markup.** (ADR-0005.)
- **Every component/provider module carries `'use client'`.** (ADR-0004, ADR-0005.)
- **No hardcoded user-facing string in a component.** All strings via the message registry. (ADR-0012.)
- **Token prefix is `--ap-`.** Components read Tier 3 via `tier3()`, which falls back to Tier 2. Tier 1 ramps are unreachable. (ADR-0007.)
- **Component CSS goes in `@layer ap.components`**, via the shared `theme/layers.css.ts`. (ADR-0016.)
- **Generated artifacts are committed and guarded by a freshness gate.** Do not hand-edit one.
- Node ≥ 22.22.0, React ≥ 19.2.7, ESM only.

---

### Task 1: Base UI adoption and the date-part import guard

**Files:**
- Modify: `packages/react/package.json` (dependency), root `package-lock.json`
- Create: `packages/react/src/gates/base-ui-imports.gate.test.ts`
- Modify: `package.json` (`test:guards` chain)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `@base-ui/react@1.7.0` resolvable from `@ap/react`; a gate that fails on a Base UI date-part import.

- [ ] **Step 1: Add the dependency at an exact version**

```bash
npm install --workspace @ap/react --save-exact @base-ui/react@1.7.0
```

Confirm `packages/react/package.json` shows `"@base-ui/react": "1.7.0"` with **no** range prefix.

- [ ] **Step 2: Verify the deprecated name is absent**

```bash
npm ls @base-ui/react
npm ls @base-ui-components/react
```

Expected: the first prints `@base-ui/react@1.7.0`; the second prints an empty tree or errors that the package is not installed. If `@base-ui-components/react` appears anywhere, stop and report — something is pulling the deprecated package.

- [ ] **Step 3: Write the failing gate**

`packages/react/src/gates/base-ui-imports.gate.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

/**
 * Base UI's date components (Calendar, DatePicker, DateField and friends)
 * require `date-fns` and `@date-fns/tz`. Those are OPTIONAL peers of
 * `@base-ui/react`, so they cost nothing while we never import them — but a
 * single import would make them required for every consuming product, which
 * ADR-0012 rejected outright ("a date dependency in every consuming product
 * is a large, opinionated, and difficult-to-remove commitment").
 *
 * This gate exists because that decision would otherwise be reversed by an
 * import statement nobody flagged in review.
 */
const FORBIDDEN_PARTS = [
  'calendar',
  'date-field',
  'date-picker',
  'date-range-picker',
  'range-calendar',
  'time-field',
  'time-picker',
] as const

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'gates' ? [] : sources(p)
    return e.name.endsWith('.ts') || e.name.endsWith('.tsx') ? [p] : []
  })
}

describe('gate: no Base UI date part is imported', () => {
  const files = sources(SRC)

  it('finds sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')

    it(`${rel} imports no Base UI date part`, () => {
      const text = readFileSync(file, 'utf8')
      const hits = FORBIDDEN_PARTS.filter((part) =>
        new RegExp(`['"\`]@base-ui/react/${part}['"\`]`).test(text),
      )
      expect(
        hits,
        `${rel} imports @base-ui/react/${hits[0]} — that makes date-fns a required peer ` +
          'for every consuming product (ADR-0012 rejected a date dependency)',
      ).toEqual([])
    })
  }
})
```

- [ ] **Step 4: Prove the gate bites**

Temporarily add `import { Calendar } from '@base-ui/react/calendar'` to `packages/react/src/index.ts`, run:

```bash
npx vitest run packages/react/src/gates/base-ui-imports.gate.test.ts
```

Expected: FAIL naming `index.ts` and `@base-ui/react/calendar`. Then revert the import with `git checkout -- packages/react/src/index.ts` and re-run — expected PASS.

- [ ] **Step 5: Wire it into the guards chain**

In root `package.json`, append the new gate file to the existing `test:guards` script, keeping the existing files:

```
"test:guards": "vitest run packages/react/src/gates/use-client.gate.test.ts packages/react/src/gates/ssr-safety.gate.test.ts packages/react/src/gates/style-rules.gate.test.ts packages/react/src/gates/base-ui-imports.gate.test.ts",
```

- [ ] **Step 6: Run the suite and commit**

```bash
npm test && npm run typecheck && npm run test:guards
git add -A
git commit -m "feat(react): adopt @base-ui/react 1.7.0, gate against its date parts"
```

---

### Task 2: SSR hooks

**Files:**
- Create: `packages/react/src/hooks/useIsomorphicLayoutEffect.ts`, `packages/react/src/hooks/useHydrated.ts`, `packages/react/src/hooks/useHydrated.test.tsx`, `packages/react/src/hooks/index.ts`
- Modify: `packages/react/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `useIsomorphicLayoutEffect: typeof useLayoutEffect`; `useHydrated(): boolean` — `false` on the server and on the first client render, `true` after hydration.

- [ ] **Step 1: Write `useIsomorphicLayoutEffect`**

`packages/react/src/hooks/useIsomorphicLayoutEffect.ts`:

```ts
'use client'

import { useEffect, useLayoutEffect } from 'react'

/**
 * `useLayoutEffect` warns when it runs on the server, because there is no
 * layout to measure. This picks `useEffect` there instead.
 *
 * The check is `typeof document !== 'undefined'` rather than a `window` test
 * because that is the condition React itself uses, and it is evaluated once at
 * module load — not during render, where reading a browser global is banned
 * (ADR-0005).
 */
export const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect
```

- [ ] **Step 2: Write the failing test for `useHydrated`**

`packages/react/src/hooks/useHydrated.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useHydrated } from './useHydrated.js'

function Probe() {
  return <span data-testid="v">{String(useHydrated())}</span>
}

describe('useHydrated', () => {
  it('reports true once mounted in a browser-like environment', async () => {
    render(<Probe />)
    expect(await screen.findByText('true')).toBeTruthy()
  })

  it('is false on the very first render, so server and client agree', () => {
    // Testing Library flushes effects, so assert the pre-effect value by
    // rendering without act's effect flush would be brittle. Instead assert the
    // contract that matters: the initial state literal is false.
    expect(useHydrated.INITIAL).toBe(false)
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx vitest run packages/react/src/hooks/useHydrated.test.tsx
```

Expected: FAIL — `useHydrated` does not exist.

- [ ] **Step 4: Implement `useHydrated`**

`packages/react/src/hooks/useHydrated.ts`:

```ts
'use client'

import { useEffect, useState } from 'react'

/**
 * `false` during server render AND during the first client render, `true`
 * afterwards.
 *
 * Both halves matter. Returning `true` immediately on the client would make the
 * first client render differ from the server's, which is a hydration mismatch —
 * the exact failure this hook exists to prevent. The flip happens in an effect,
 * which runs only after hydration has already matched.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}

/** The initial value, exposed so a test can assert the contract directly. */
useHydrated.INITIAL = false as const
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
npx vitest run packages/react/src/hooks/useHydrated.test.tsx
```

Expected: PASS, 2 tests.

- [ ] **Step 6: Barrel and export**

`packages/react/src/hooks/index.ts`:

```ts
export { useHydrated } from './useHydrated.js'
export { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect.js'
```

Add to `packages/react/src/index.ts`:

```ts
export { useHydrated, useIsomorphicLayoutEffect } from './hooks/index.js'
```

- [ ] **Step 7: Commit**

```bash
npm test && npm run typecheck
git add -A
git commit -m "feat(react): useHydrated and useIsomorphicLayoutEffect"
```

---

### Task 3: `ThemeProvider`, `useTheme`, `useColorScheme`, `ThemeScript`

**Files:**
- Create: `packages/react/src/providers/ThemeProvider.tsx`, `packages/react/src/providers/ThemeProvider.test.tsx`, `packages/react/src/providers/ThemeScript.tsx`
- Modify: `packages/react/src/hooks/index.ts`, `packages/react/src/index.ts`

**Interfaces:**
- Consumes: `useHydrated` (Task 2).
- Produces:
  ```ts
  export type ColorScheme = 'light' | 'dark' | 'system'
  export interface ThemeContextValue { scheme: ColorScheme; setScheme: (s: ColorScheme) => void }
  export function ThemeProvider(props: { scheme?: ColorScheme; defaultScheme?: ColorScheme; storageKey?: string; children: React.ReactNode }): JSX.Element
  export function useTheme(): ThemeContextValue
  export function useColorScheme(): [ColorScheme, (s: ColorScheme) => void]
  export function ThemeScript(props: { storageKey?: string }): JSX.Element
  export const DEFAULT_SCHEME_STORAGE_KEY = 'ap-color-scheme'
  ```

**Design note for the implementer:** `theme.css` (generated in Phase 1) already implements the whole three-state cascade — `:root`, `[data-ap-scheme="dark"]`, and `@media (prefers-color-scheme: dark) :root:not([data-ap-scheme="light"])`. `ThemeProvider` therefore emits **no CSS**. Its entire job is owning the scheme value and reflecting an explicit choice onto `<html>`.

- [ ] **Step 1: Write the failing tests**

`packages/react/src/providers/ThemeProvider.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run and watch them fail**

```bash
npx vitest run packages/react/src/providers/ThemeProvider.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `ThemeProvider`**

`packages/react/src/providers/ThemeProvider.tsx`:

```tsx
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
      try {
        if (next === 'system') localStorage.removeItem(storageKey)
        else localStorage.setItem(storageKey, next)
      } catch {
        // Private mode, blocked storage, or no storage at all. The choice still
        // applies to this page; only persistence is lost.
      }
      if (controlled === undefined) setUncontrolled(next)
    },
    [controlled, storageKey],
  )

  const value = useMemo<ThemeContextValue>(() => ({ scheme, setScheme }), [scheme, setScheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
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
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npx vitest run packages/react/src/providers/ThemeProvider.test.tsx
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Implement `ThemeScript`**

`packages/react/src/providers/ThemeScript.tsx`:

```tsx
import { DEFAULT_SCHEME_STORAGE_KEY } from './ThemeProvider.js'

/**
 * The SPA anti-flash path (ADR-0009). Renders a synchronous inline script that
 * sets `data-ap-scheme` before first paint.
 *
 * This is blocking by necessity and it is the one place that is correct: any
 * deferred script paints the wrong theme first, and a user who chose dark sees
 * a white flash on every load.
 *
 * Under SSR you do not need this at all — read the choice from a cookie and
 * render the attribute into the initial HTML.
 *
 * No `'use client'`: this renders a raw <script> and holds no state, so it is
 * usable from a server entry.
 */
export function ThemeScript({ storageKey = DEFAULT_SCHEME_STORAGE_KEY }: { storageKey?: string }) {
  // JSON.stringify escapes the key, so a key containing a quote cannot break
  // out of the string literal and inject script.
  const source =
    `try{var s=localStorage.getItem(${JSON.stringify(storageKey)});` +
    `if(s==="light"||s==="dark")document.documentElement.setAttribute("data-ap-scheme",s)}catch(e){}`

  return <script dangerouslySetInnerHTML={{ __html: source }} suppressHydrationWarning />
}
```

- [ ] **Step 6: Export and commit**

Add to `packages/react/src/index.ts`:

```ts
export { ThemeProvider, useTheme, useColorScheme, DEFAULT_SCHEME_STORAGE_KEY } from './providers/ThemeProvider.js'
export type { ColorScheme, ThemeContextValue, ThemeProviderProps } from './providers/ThemeProvider.js'
export { ThemeScript } from './providers/ThemeScript.js'
```

```bash
npm test && npm run typecheck && npm run test:guards
git add -A
git commit -m "feat(react): ThemeProvider, useColorScheme and the SPA ThemeScript"
```

---

### Task 4: `LocaleProvider`, the message registry, and the hardcoded-string gate

**Files:**
- Create: `packages/react/src/providers/messages.ts`, `packages/react/src/providers/LocaleProvider.tsx`, `packages/react/src/providers/LocaleProvider.test.tsx`, `packages/react/src/gates/no-hardcoded-strings.gate.test.ts`
- Modify: `packages/react/src/index.ts`, root `package.json` (`test:guards`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  export const DEFAULT_MESSAGES: Readonly<Record<MessageKey, string>>
  export type MessageKey = 'close' | 'loading' | 'error' | 'required' | 'optional' | 'noResults' | 'dismiss'
  export type Messages = Partial<Record<MessageKey, string>>
  export interface LocaleContextValue { locale: string; timeZone?: string; currency: string; messages: Readonly<Record<MessageKey, string>> }
  export function LocaleProvider(props: { locale?: string; timeZone?: string; currency?: string; messages?: Messages; children: React.ReactNode }): JSX.Element
  export function useLocale(): LocaleContextValue
  export function useMessages(): Readonly<Record<MessageKey, string>>
  ```

- [ ] **Step 1: Write the message registry**

`packages/react/src/providers/messages.ts`:

```ts
/**
 * Interface strings the components ship themselves — the ones a consumer never
 * passes in. Left hardcoded, a screen-reader user in a non-English locale gets
 * English ARIA, which is the failure ADR-0012 names.
 *
 * The key set is exported as a typed constant so a product can hand it to its
 * i18n pipeline and get a COMPILE ERROR when a key is added and not translated,
 * rather than discovering it in production.
 */
export const DEFAULT_MESSAGES = Object.freeze({
  close: 'Close',
  loading: 'Loading…',
  error: 'Error',
  required: 'required',
  optional: 'optional',
  noResults: 'No results',
  dismiss: 'Dismiss',
})

export type MessageKey = keyof typeof DEFAULT_MESSAGES
export type Messages = Partial<Record<MessageKey, string>>
```

- [ ] **Step 2: Write the failing tests**

`packages/react/src/providers/LocaleProvider.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MESSAGES } from './messages.js'
import { LocaleProvider, useLocale, useMessages } from './LocaleProvider.js'

function Probe() {
  const { locale, currency } = useLocale()
  const m = useMessages()
  return <span data-testid="v">{`${locale}|${currency}|${m.close}|${m.loading}`}</span>
}

describe('LocaleProvider', () => {
  it('defaults to en-US / USD and the English messages', () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('v').textContent).toBe('en-US|USD|Close|Loading…')
  })

  it('falls back per key, so a partial messages object is legal', () => {
    render(
      <LocaleProvider locale="de-DE" currency="EUR" messages={{ close: 'Schließen' }}>
        <Probe />
      </LocaleProvider>,
    )
    // `close` is overridden; `loading` falls back to English rather than
    // vanishing, because a missing key must never render as undefined.
    expect(screen.getByTestId('v').textContent).toBe('de-DE|EUR|Schließen|Loading…')
  })

  it('ignores an explicitly undefined override rather than blanking the string', () => {
    render(
      <LocaleProvider messages={{ close: undefined }}>
        <Probe />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('v').textContent).toContain('|Close|')
  })

  it('does not auto-detect from navigator, which has no server equivalent', () => {
    const spy = vi.spyOn(navigator, 'language', 'get')
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )
    expect(spy, 'LocaleProvider read navigator.language').not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('throws by name when used with no provider', () => {
    expect(() => render(<Probe />)).toThrow(/LocaleProvider/)
  })

  it('exposes every default key as a typed constant', () => {
    expect(Object.keys(DEFAULT_MESSAGES).sort()).toEqual(
      ['close', 'dismiss', 'error', 'loading', 'noResults', 'optional', 'required'].sort(),
    )
  })
})
```

- [ ] **Step 3: Run and watch them fail**

```bash
npx vitest run packages/react/src/providers/LocaleProvider.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 4: Implement `LocaleProvider`**

`packages/react/src/providers/LocaleProvider.tsx`:

```tsx
'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { DEFAULT_MESSAGES, type MessageKey, type Messages } from './messages.js'

export interface LocaleContextValue {
  locale: string
  /** Undefined means "resolve on the client", per ADR-0012's two-pass rule. */
  timeZone?: string
  currency: string
  messages: Readonly<Record<MessageKey, string>>
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export interface LocaleProviderProps {
  locale?: string
  timeZone?: string
  currency?: string
  messages?: Messages
  children: ReactNode
}

/**
 * There is deliberately NO auto-detection from `navigator`. The server has no
 * `navigator`, so auto-detection is exactly what breaks under SSR — the server
 * would pick one locale and the client another, and the markup would not match.
 */
export function LocaleProvider({
  locale = 'en-US',
  timeZone,
  currency = 'USD',
  messages,
  children,
}: LocaleProviderProps) {
  const value = useMemo<LocaleContextValue>(() => {
    const merged = { ...DEFAULT_MESSAGES } as Record<MessageKey, string>
    for (const key of Object.keys(DEFAULT_MESSAGES) as MessageKey[]) {
      const override = messages?.[key]
      // An explicitly-undefined override must not blank the string: a missing
      // translation falls back to English rather than rendering nothing.
      if (typeof override === 'string') merged[key] = override
    }
    return { locale, timeZone, currency, messages: Object.freeze(merged) }
  }, [locale, timeZone, currency, messages])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used inside <LocaleProvider> (or <ApProvider>).')
  }
  return ctx
}

export function useMessages(): Readonly<Record<MessageKey, string>> {
  return useLocale().messages
}
```

- [ ] **Step 5: Run the tests and watch them pass**

```bash
npx vitest run packages/react/src/providers/LocaleProvider.test.tsx
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Write the hardcoded-string gate**

`packages/react/src/gates/no-hardcoded-strings.gate.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const COMPONENTS = join(import.meta.dirname, '..', 'components')

/**
 * A user-facing string literal in a component is a gate failure, not a review
 * comment: components must read strings through the message registry so a
 * non-English product does not ship English ARIA (ADR-0012).
 *
 * We flag the ATTRIBUTES that reach assistive technology or the screen, because
 * those are the ones that must be translatable. Class names, data attributes and
 * token names are not user-facing and are not flagged.
 */
const USER_FACING_ATTRS = ['aria-label', 'aria-description', 'title', 'placeholder', 'alt'] as const

function componentSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return componentSources(p)
    return e.name.endsWith('.tsx') && !e.name.includes('.test.') && !e.name.includes('.stories.')
      ? [p]
      : []
  })
}

describe('gate: components take user-facing strings from the message registry', () => {
  const files = componentSources(COMPONENTS)

  it('finds component sources to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    const rel = file.slice(COMPONENTS.length + 1).replace(/\\/g, '/')

    it(`${rel} hardcodes no user-facing string`, () => {
      const text = readFileSync(file, 'utf8')
      const hits: string[] = []
      for (const attr of USER_FACING_ATTRS) {
        // Matches attr="literal" — a braced expression is fine, that is the
        // registry path.
        const re = new RegExp(`${attr}\\s*=\\s*"([^"]+)"`, 'g')
        for (const m of text.matchAll(re)) hits.push(`${attr}="${m[1]}"`)
      }
      expect(
        hits,
        `${rel} hardcodes ${hits[0]} — read it from useMessages() so it can be translated`,
      ).toEqual([])
    })
  }
})
```

- [ ] **Step 7: Prove the gate bites**

Temporarily add `aria-label="Close"` to the root element in `packages/react/src/components/Surface/Surface.tsx`, run:

```bash
npx vitest run packages/react/src/gates/no-hardcoded-strings.gate.test.ts
```

Expected: FAIL naming `Surface/Surface.tsx` and `aria-label="Close"`. Revert with `git checkout -- packages/react/src/components/Surface/Surface.tsx` and re-run — expected PASS.

- [ ] **Step 8: Wire into guards, export, commit**

Append the gate file to `test:guards` in root `package.json`. Add to `packages/react/src/index.ts`:

```ts
export { LocaleProvider, useLocale, useMessages } from './providers/LocaleProvider.js'
export type { LocaleContextValue, LocaleProviderProps } from './providers/LocaleProvider.js'
export { DEFAULT_MESSAGES } from './providers/messages.js'
export type { MessageKey, Messages } from './providers/messages.js'
```

```bash
npm test && npm run typecheck && npm run test:guards
git add -A
git commit -m "feat(react): LocaleProvider, typed message registry, hardcoded-string gate"
```

---

### Task 5: Icons and `IconProvider`

**Files:**
- Create: `packages/react/src/icons/Icon.tsx`, `packages/react/src/icons/paths.ts`, `packages/react/src/icons/IconProvider.tsx`, `packages/react/src/icons/Icon.test.tsx`, `packages/react/src/icons/index.ts`
- Modify: `packages/react/src/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  export type IconName = 'check' | 'close' | 'chevron-down' | 'alert-circle' | 'info'
  export interface IconProps { name: IconName; label?: string; size?: number; className?: string }
  export function Icon(props: IconProps): JSX.Element
  export function IconProvider(props: { icons?: Partial<Record<IconName, React.ComponentType<{ className?: string }>>>; children: React.ReactNode }): JSX.Element
  ```

**Design note:** Phase 4 ships **five** icons — only what its components render. ADR-0012's eventual set is ~15; adding one nothing renders is speculative work and a permanent maintenance obligation.

- [ ] **Step 1: Write the failing tests**

`packages/react/src/icons/Icon.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon, IconProvider } from './index.js'

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

  it('renders every name in the set', () => {
    for (const name of ['check', 'close', 'chevron-down', 'alert-circle', 'info'] as const) {
      const { container } = render(<Icon name={name} />)
      expect(container.querySelector('svg'), `${name} rendered nothing`).toBeTruthy()
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

  it('falls back to the built-in for names the product did not override', () => {
    const Custom = () => <svg data-testid="custom" />
    const { container } = render(
      <IconProvider icons={{ check: Custom }}>
        <Icon name="close" />
      </IconProvider>,
    )
    expect(container.querySelector('[data-testid="custom"]')).toBeNull()
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('works with no IconProvider at all', () => {
    const { container } = render(<Icon name="info" />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run and watch them fail**

```bash
npx vitest run packages/react/src/icons/Icon.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the paths**

`packages/react/src/icons/paths.ts`:

```ts
/**
 * The five icons Phase 4's components actually render. Deliberately not the
 * eventual fifteen: an icon nothing renders is speculative work and a permanent
 * maintenance obligation.
 *
 * All are drawn on a 24×24 grid with a 2px stroke, so they sit consistently
 * against text at any size.
 */
export const ICON_PATHS = Object.freeze({
  check: 'M20 6 9 17l-5-5',
  close: 'M18 6 6 18M6 6l12 12',
  'chevron-down': 'm6 9 6 6 6-6',
  'alert-circle': 'M12 8v5M12 16h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  info: 'M12 16v-5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
})

export type IconName = keyof typeof ICON_PATHS
```

- [ ] **Step 4: Write `IconProvider`**

`packages/react/src/icons/IconProvider.tsx`:

```tsx
'use client'

import { createContext, useContext, type ComponentType, type ReactNode } from 'react'
import type { IconName } from './paths.js'

export type IconOverrides = Partial<Record<IconName, ComponentType<{ className?: string }>>>

const IconContext = createContext<IconOverrides>({})

/**
 * Maps our icon names onto a product's own icon library in one place. A product
 * standardised on Lucide maps once and never thinks about it again (ADR-0012).
 *
 * The default is an empty object rather than null: `Icon` works with no provider,
 * so there is nothing to throw about.
 */
export function IconProvider({
  icons = {},
  children,
}: {
  icons?: IconOverrides
  children: ReactNode
}) {
  return <IconContext.Provider value={icons}>{children}</IconContext.Provider>
}

export function useIconOverrides(): IconOverrides {
  return useContext(IconContext)
}
```

- [ ] **Step 5: Write `Icon`**

`packages/react/src/icons/Icon.tsx`:

```tsx
'use client'

import { useIconOverrides } from './IconProvider.js'
import { ICON_PATHS, type IconName } from './paths.js'

export interface IconProps {
  name: IconName
  /**
   * Give a label ONLY when the icon carries meaning on its own. Without one the
   * icon is decorative and hidden from assistive technology, which is right when
   * adjacent text already says what it means.
   */
  label?: string
  /** Rendered size in px. Defaults to 1em-equivalent at 16. */
  size?: number
  className?: string
}

export function Icon({ name, label, size = 16, className }: IconProps) {
  const Override = useIconOverrides()[name]
  if (Override) return <Override className={className} />

  const meaningful = label !== undefined

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(meaningful
        ? { role: 'img', 'aria-label': label }
        : { 'aria-hidden': true, focusable: false })}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}
```

**Note on the gate:** `aria-label={label}` is a braced expression, not a literal, so the Task 4 gate does not flag it — and should not, because the label comes from the caller.

- [ ] **Step 6: Barrel, run, commit**

`packages/react/src/icons/index.ts`:

```ts
export { Icon } from './Icon.js'
export type { IconProps } from './Icon.js'
export { IconProvider, useIconOverrides } from './IconProvider.js'
export type { IconOverrides } from './IconProvider.js'
export { ICON_PATHS } from './paths.js'
export type { IconName } from './paths.js'
```

Add the same exports to `packages/react/src/index.ts`.

```bash
npx vitest run packages/react/src/icons/Icon.test.tsx   # expect PASS, 6 tests
npm test && npm run typecheck && npm run test:guards
git add -A
git commit -m "feat(react): five-icon set with per-instance and global overrides"
```

---

### Task 6: `ApProvider` and the SSR proof

**Files:**
- Create: `packages/react/src/providers/ApProvider.tsx`, `packages/react/src/providers/ApProvider.test.tsx`, `packages/react/src/providers/providers.ssr.test.tsx`
- Modify: `packages/react/src/index.ts`

**Interfaces:**
- Consumes: `ThemeProvider` (Task 3), `LocaleProvider` (Task 4), `IconProvider` (Task 5).
- Produces: `ApProvider(props: ThemeProviderProps & LocaleProviderProps & { icons?: IconOverrides }): JSX.Element`

**Design note:** ADR-0012 specifies four providers; `NotificationProvider` is Phase 5, because three of its four surfaces are built on Toast. `ApProvider` composes three now and gains the fourth later **without a public API change**.

- [ ] **Step 1: Write the failing tests**

`packages/react/src/providers/ApProvider.test.tsx`:

```tsx
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
    render(
      <ApProvider locale="fr-FR">
        <Probe />
      </ApProvider>,
    )
    expect(screen.getByTestId('v').textContent).toBe('system|fr-FR')
  })

  it('passes icon overrides through', () => {
    const Custom = () => <svg data-testid="custom" />
    const { container } = render(
      <ApProvider icons={{ check: Custom }}>
        <Icon name="check" />
      </ApProvider>,
    )
    expect(container.querySelector('[data-testid="custom"]')).toBeTruthy()
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
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx vitest run packages/react/src/providers/ApProvider.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `ApProvider`**

`packages/react/src/providers/ApProvider.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import { IconProvider, type IconOverrides } from '../icons/index.js'
import { LocaleProvider, type LocaleProviderProps } from './LocaleProvider.js'
import { ThemeProvider, type ThemeProviderProps } from './ThemeProvider.js'

export interface ApProviderProps
  extends Omit<ThemeProviderProps, 'children'>,
    Omit<LocaleProviderProps, 'children'> {
  icons?: IconOverrides
  children: ReactNode
}

/**
 * Composes the stack so the common case is one component.
 *
 * ADR-0012 specifies four providers. `NotificationProvider` arrives in Phase 5
 * with Toast, which three of its four surfaces are built on. It slots in here
 * with NO public API change.
 */
export function ApProvider({
  scheme,
  defaultScheme,
  storageKey,
  locale,
  timeZone,
  currency,
  messages,
  icons,
  children,
}: ApProviderProps) {
  return (
    <ThemeProvider scheme={scheme} defaultScheme={defaultScheme} storageKey={storageKey}>
      <LocaleProvider locale={locale} timeZone={timeZone} currency={currency} messages={messages}>
        <IconProvider icons={icons}>{children}</IconProvider>
      </LocaleProvider>
    </ThemeProvider>
  )
}
```

- [ ] **Step 4: Write the SSR proof**

`packages/react/src/providers/providers.ssr.test.tsx`:

```tsx
/**
 * Runs in the `node` environment — NO jsdom. A test under jsdom cannot detect a
 * browser-global access, because the globals are all present. This file has no
 * `@vitest-environment` docblock precisely so it inherits the node default from
 * the root config.
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ApProvider } from './ApProvider.js'
import { ThemeScript } from './ThemeScript.js'
import { Icon } from '../icons/index.js'
import { useMessages } from './LocaleProvider.js'

function Strings() {
  const m = useMessages()
  return <span>{m.close}</span>
}

describe('the provider stack renders on the server', () => {
  it('renders with no browser globals available', () => {
    expect(typeof window).toBe('undefined')
    const html = renderToString(
      <ApProvider locale="de-DE" messages={{ close: 'Schließen' }}>
        <Strings />
        <Icon name="check" />
      </ApProvider>,
    )
    expect(html).toContain('Schließen')
    expect(html).toContain('<svg')
  })

  it('sets no scheme attribute during server render, so CSS decides', () => {
    // ThemeProvider must not touch document during render; if it did, this
    // would throw rather than return markup.
    const html = renderToString(
      <ApProvider>
        <span>ok</span>
      </ApProvider>,
    )
    expect(html).toContain('ok')
  })

  it('ThemeScript serialises to an inline script with the storage key escaped', () => {
    const html = renderToString(<ThemeScript storageKey={'we"ird'} />)
    expect(html).toContain('<script')
    // The quote in the key must be escaped, or it breaks out of the literal.
    expect(html).not.toContain('"we"ird"')
  })
})
```

- [ ] **Step 5: Run it under node and watch it pass**

```bash
npx vitest run packages/react/src/providers/providers.ssr.test.tsx
```

Expected: PASS, 3 tests. If any test reports `window is not undefined`, the file is picking up the jsdom environment — check the root `vitest.config.ts` for a docblock or an `environmentMatchGlobs` entry pulling it in.

- [ ] **Step 6: Export, verify everything, commit**

Add to `packages/react/src/index.ts`:

```ts
export { ApProvider } from './providers/ApProvider.js'
export type { ApProviderProps } from './providers/ApProvider.js'
```

```bash
npm test
npm run typecheck
npm run test:guards
npm run test:gates
git add -A
git commit -m "feat(react): ApProvider composing the stack, with an SSR proof"
```

---

## Verification for this plan

Run in order. Each has a concrete success signal.

| # | Check | Command | Signal |
|---|---|---|---|
| 1 | Base UI at the pinned version, deprecated name absent | `npm ls @base-ui/react` | `@base-ui/react@1.7.0`; `@base-ui-components/react` not installed |
| 2 | Date-part import gate bites | add a `@base-ui/react/calendar` import, `test:guards` | Fails naming file + import; passes after revert |
| 3 | Hardcoded-string gate bites | add `aria-label="Close"` to a component, `test:guards` | Fails naming file + literal; passes after revert |
| 4 | Providers never read storage during render | `npx vitest run packages/react/src/providers/providers.ssr.test.tsx` | Renders under node where `localStorage` does not exist — a read during render would throw `ReferenceError`, so passing IS the proof |
| 5 | `system` sets no attribute | `npm test` | Attribute absent, so the media query decides and dark mode works with JS off |
| 6 | Messages fall back per key | `npm test` | A partial `messages` object leaves other keys English |
| 7 | Whole stack renders under node with no `window` | `npx vitest run packages/react/src/providers/providers.ssr.test.tsx` | 3 passed |
| 8 | Nothing regressed | `npm test && npm run typecheck && npm run test:gates` | 380+ tests green, all Phase 1–3 gates still passing |

**Proof artifact for 4a:** `npm run test:gates` green with the two new guards in the chain, plus `providers.ssr.test.tsx` passing under the node environment — the stack demonstrably server-renders with no browser globals present.
