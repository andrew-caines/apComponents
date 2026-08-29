import type { Mode } from '../colour/types.js'

export const SPACE: Record<string, string> = {
  '0': '0px', '1': '2px', '2': '4px', '3': '8px', '4': '12px',
  '5': '16px', '6': '24px', '7': '32px', '8': '48px', '9': '64px',
}

export const TEXT: Record<string, { size: string; lineHeight: string }> = {
  xs: { size: '12px', lineHeight: '16px' },
  sm: { size: '14px', lineHeight: '20px' },
  md: { size: '16px', lineHeight: '24px' },
  lg: { size: '18px', lineHeight: '28px' },
  xl: { size: '20px', lineHeight: '28px' },
  '2xl': { size: '24px', lineHeight: '32px' },
}

export const RADIUS: Record<string, string> = {
  sm: '4px', md: '6px', lg: '10px', xl: '16px', full: '9999px',
}

export const Z: Record<string, number> = {
  sticky: 1100, backdrop: 1300, dialog: 1400, popover: 1500, toast: 1600, tooltip: 1700,
}

export const ELEVATION: Record<Mode, Record<string, string>> = {
  light: {
    '1': '0 1px 2px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.10)',
    '2': '0 2px 6px rgb(0 0 0 / 0.08), 0 4px 12px rgb(0 0 0 / 0.10)',
    '3': '0 8px 16px rgb(0 0 0 / 0.10), 0 12px 32px rgb(0 0 0 / 0.14)',
  },
  dark: {
    '1': '0 1px 2px rgb(0 0 0 / 0.30)',
    '2': '0 2px 6px rgb(0 0 0 / 0.35)',
    '3': '0 8px 20px rgb(0 0 0 / 0.45)',
  },
}

export const MISC: Record<string, string> = {
  'focus-ring-width': '2px',
  'focus-ring-offset': '2px',
  'hit-target': '24px',
  'hit-target-coarse': '44px',
  'font-numeric': "'tnum'",
}
