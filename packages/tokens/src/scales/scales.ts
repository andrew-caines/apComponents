import type { Mode } from '../colour/types.js'

// Every scale is a shared singleton handed straight out on `theme.scales`, so
// each one is frozen at declaration: a consumer mutating a scale would silently
// change every theme in the process, including ones already emitted.

export const SPACE = Object.freeze({
  '0': '0px', '1': '2px', '2': '4px', '3': '8px', '4': '12px',
  '5': '16px', '6': '24px', '7': '32px', '8': '48px', '9': '64px',
} as Record<string, string>)

export const TEXT = Object.freeze({
  xs: { size: '12px', lineHeight: '16px' },
  sm: { size: '14px', lineHeight: '20px' },
  md: { size: '16px', lineHeight: '24px' },
  lg: { size: '18px', lineHeight: '28px' },
  xl: { size: '20px', lineHeight: '28px' },
  '2xl': { size: '24px', lineHeight: '32px' },
} as Record<string, { size: string; lineHeight: string }>)

export const RADIUS = Object.freeze({
  sm: '4px', md: '6px', lg: '10px', xl: '16px', full: '9999px',
} as Record<string, string>)

export const Z = Object.freeze({
  sticky: 1100, backdrop: 1300, dialog: 1400, popover: 1500, toast: 1600, tooltip: 1700,
} as Record<string, number>)

export const ELEVATION: Readonly<Record<Mode, Readonly<Record<string, string>>>> = Object.freeze({
  light: Object.freeze({
    '1': '0 1px 2px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.10)',
    '2': '0 2px 6px rgb(0 0 0 / 0.08), 0 4px 12px rgb(0 0 0 / 0.10)',
    '3': '0 8px 16px rgb(0 0 0 / 0.10), 0 12px 32px rgb(0 0 0 / 0.14)',
  } as Record<string, string>),
  dark: Object.freeze({
    '1': '0 1px 2px rgb(0 0 0 / 0.30)',
    '2': '0 2px 6px rgb(0 0 0 / 0.35)',
    '3': '0 8px 20px rgb(0 0 0 / 0.45)',
  } as Record<string, string>),
})

export const MISC = Object.freeze({
  'focus-ring-width': '2px',
  'focus-ring-offset': '2px',
  'hit-target': '24px',
  'hit-target-coarse': '44px',
  'font-numeric': "'tnum'",
} as Record<string, string>)
