import { useEffect } from 'react'
import { Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration } from 'react-router'
import { ApProvider, ThemeScript, useTheme, type ColorScheme } from '@ap/react'
import '@ap/react/fonts.css'
import '@ap/react/theme.css'
// Not optional: components declare animation as `animation: var(--ap-motion-*)`,
// which resolves to nothing without this. The failure is silent — Dialog would
// still open, it just would not animate.
import '@ap/react/motion.css'
import { SECTIONS } from './sections.js'
import './showcase.css'

const SCHEMES: ColorScheme[] = ['light', 'dark', 'system']

/**
 * Light / dark / system. Every page should be checkable in both schemes without
 * touching OS settings — a component that looks right in one and wrong in the
 * other is the most common thing a showcase is for.
 */
function SchemeToggle() {
  const { scheme, setScheme } = useTheme()
  return (
    <div className="nav-spacer row" style={{ gap: 'var(--ap-space-1)' }}>
      {SCHEMES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => setScheme(s)}
          aria-pressed={scheme === s}
          className="chip"
          style={{
            padding: 'var(--ap-space-1) var(--ap-space-3)',
            border: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'var(--ap-text-xs-size)',
            background:
              scheme === s ? 'var(--ap-color-action-bg-subtle)' : 'transparent',
            color: scheme === s ? 'var(--ap-color-action-text)' : 'var(--ap-color-text-secondary)',
          }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

function Nav() {
  return (
    <nav className="nav" aria-label="Showcase sections">
      <span className="nav-brand">ap</span>
      <NavLink to="/">Overview</NavLink>
      {/* Derived from SECTIONS, so this bar can never drift from the routes. */}
      {SECTIONS.map((s) => (
        <NavLink key={s.slug} to={`/${s.slug}`}>
          {s.title}
        </NavLink>
      ))}
      <SchemeToggle />
    </nav>
  )
}

export default function Root() {
  useEffect(() => {
    // Same client-only marker the SSR fixture uses: an effect runs only after
    // hydration completes, so the smoke test can wait on a real signal instead
    // of a sleep.
    document.documentElement.dataset.apHydrated = 'true'
  }, [])

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>ap components</title>
        <Meta />
        <Links />
        <ThemeScript />
      </head>
      <body>
        <ApProvider>
          <Nav />
          <Outlet />
        </ApProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
