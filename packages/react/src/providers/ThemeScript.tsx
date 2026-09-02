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
