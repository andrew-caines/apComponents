import type { Mode } from '../colour/types.js'

// Every scale is a shared singleton handed straight out on `theme.scales`, so
// each one is frozen at declaration: a consumer mutating a scale would silently
// change every theme in the process, including ones already emitted.

export const SPACE = Object.freeze({
  '0': '0px', '1': '2px', '2': '4px', '3': '8px', '4': '12px',
  '5': '16px', '6': '24px', '7': '32px', '8': '48px', '9': '64px',
} as Record<string, string>)

// Each entry is frozen too — freezing only the container still let
// `theme.scales.text.md.size = '99px'` through, polluting every later theme.
export const TEXT = Object.freeze({
  // Legal lines, disclaimers, footnotes — deliberately below the ramp, and
  // deliberately NOT named as a step: `fine-print` sits outside the xs…2xl
  // series, so it carries no ICON counterpart and no one has to keep one in
  // sync. An icon set beside it uses `md` (1em) and tracks it automatically.
  //
  // 11px is the floor, not a preference. Below it the x-height of Inter at
  // 1x stops resolving reliably, and WCAG gives small text no exemption:
  // the 3:1 allowance starts at 24px (or 18.66px bold), so fine print always
  // needs a 4.5:1 foreground. Pair it with text-primary/secondary or a
  // `-text` role token, never with a border or focus-ring token — those are
  // gated at 3:1 and are not text colours.
  'fine-print': Object.freeze({ size: '11px', lineHeight: '16px' }),
  xs: Object.freeze({ size: '12px', lineHeight: '16px' }),
  sm: Object.freeze({ size: '14px', lineHeight: '20px' }),
  md: Object.freeze({ size: '16px', lineHeight: '24px' }),
  lg: Object.freeze({ size: '20px', lineHeight: '28px' }),
  xl: Object.freeze({ size: '24px', lineHeight: '32px' }),
  '2xl': Object.freeze({ size: '32px', lineHeight: '40px' }),
} as Record<string, Readonly<{ size: string; lineHeight: string }>>)

export const RADIUS = Object.freeze({
  sm: '4px', md: '6px', lg: '10px', xl: '16px', full: '9999px',
} as Record<string, string>)

// `em`, deliberately, not px: an icon sized in `em` tracks the font size of
// its context (not the root), so an icon inside a small button shrinks with
// the button's text automatically, with no per-call-site coordination.
//
// These steps are multipliers, NOT absolute sizes, so a named ICON step and
// the TEXT step of the same name are not interchangeable: `icon-lg` inside
// `text-lg` renders at 1.25 x 20px = 25px, because both scale. To match an
// icon to the text beside it, use `md` (1em) at any text step; reach for
// another step only to make an icon deliberately smaller or larger than its
// neighbouring text.
//
// The numbers are TEXT read at the 16px base — 0.75em is text-xs's 12px,
// 1.25em is text-lg's 20px, 2em is text-2xl's 32px — so the two scales stay
// proportional. They are literals here rather than derived from TEXT at
// runtime, so nothing catches them drifting: change them together. See the
// note in CONTRIBUTING.md.
export const ICON = Object.freeze({
  xs: '0.75em', sm: '0.875em', md: '1em', lg: '1.25em', xl: '1.5em', '2xl': '2em',
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
