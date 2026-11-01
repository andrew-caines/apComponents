/**
 * Internal manifest of the built-in icons. Not exported from the package entry.
 * `lucide` is the matching Lucide icon name (data only; nothing here imports
 * Lucide), or null when there is no counterpart.
 */
export const CATALOGUE: Readonly<Record<string, { readonly lucide: string | null }>> =
  Object.freeze({
    check: { lucide: 'check' },
    x: { lucide: 'x' },
    'chevron-down': { lucide: 'chevron-down' },
    info: { lucide: 'info' },
    'alert-circle': { lucide: 'circle-alert' },
    'check-circle': { lucide: 'circle-check' },
    'alert-triangle': { lucide: 'triangle-alert' },
  })

/** Ported unchanged in icons-core. icons-pilot redraws them and empties this list. */
export const PENDING_REDRAW: readonly string[] = ['check', 'chevron-down']
