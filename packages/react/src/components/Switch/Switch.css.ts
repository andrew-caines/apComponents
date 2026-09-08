import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { SWITCH_TOKENS as t } from './Switch.tokens.js'

/**
 * The gap between the track's edge and the thumb, on every side, at every
 * size — a single space-scale token rather than a per-size value, so the
 * thumb-size and checked-position formulas below only have ONE size-driven
 * input (the track's own dimensions) instead of two independent scales that
 * could drift out of sync.
 */
const PADDING = vars.space['1']

/**
 * Track dimensions per size, both from the space scale. The thumb never
 * declares its own inline/block size from the scale directly — it derives
 * them from these same two numbers (see `switchThumbRecipe` below), so a
 * track and its thumb can never end up with mismatched geometry.
 */
const TRACK = {
  sm: { inline: vars.space['6'], block: vars.space['4'] },
  md: { inline: vars.space['7'], block: vars.space['5'] },
  lg: { inline: vars.space['8'], block: vars.space['6'] },
} as const

/**
 * The track: `Switch.Root`, a `<span role="switch">`. Filled and borderless
 * (unlike `Checkbox`'s outlined box), so its OFF look is carried entirely by
 * `trackBg` on the base rule, and the `[data-checked]` selector below swaps
 * it for `trackBgChecked` — Base UI's own state attribute
 * (SwitchRootDataAttributes), never one of our own invention.
 */
export const switchTrackRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        position: 'relative',
        display: 'inline-flex',
        flexShrink: 0,
        alignItems: 'center',
        background: t.trackBg,
        borderRadius: t.radius,
        cursor: 'pointer',
        selectors: {
          // Longhand, matching Input.css.ts/Checkbox.css.ts: `outline`, never
          // `boxShadow` — an outline survives forced-colors mode, where
          // box-shadow is dropped entirely. The style-rules gate enforces
          // this.
          '&:focus-visible': {
            outlineWidth: vars.misc.focusRingWidth,
            outlineStyle: 'solid',
            outlineColor: t.focusRing,
            outlineOffset: vars.misc.focusRingOffset,
          },
          '&[data-checked]': {
            background: t.trackBgChecked,
          },
          '&[data-disabled]': {
            cursor: 'default',
            opacity: 0.6,
          },
        },
      },
    },
  },
  variants: {
    size: {
      sm: {
        '@layer': {
          [componentsLayer]: { inlineSize: TRACK.sm.inline, blockSize: TRACK.sm.block },
        },
      },
      md: {
        '@layer': {
          [componentsLayer]: { inlineSize: TRACK.md.inline, blockSize: TRACK.md.block },
        },
      },
      lg: {
        '@layer': {
          [componentsLayer]: { inlineSize: TRACK.lg.inline, blockSize: TRACK.lg.block },
        },
      },
    },
  },
  defaultVariants: { size: 'md' },
})

/**
 * The thumb: `Switch.Thumb`, positioned with `insetInlineStart` — never
 * `left`, which the style gate bans outright. `insetInlineStart` is what
 * keeps this correct under direction flipping: in an RTL locale the inline
 * axis itself reverses, so "the end of the track" is a smaller
 * `insetInlineStart` value there and a larger one in LTR, with no
 * conditional logic here — the SAME declarations produce the mirrored
 * result in both directions. A `transform: translateX(px)` would not: a
 * fixed positive translation moves the thumb toward the visual right
 * regardless of direction, which is correct in LTR and wrong in RTL.
 *
 * The unchecked position is `PADDING` from the track's start edge; the
 * checked position is derived algebraically from the same two per-size
 * numbers the track itself uses (see `TRACK` above), so the thumb's size and
 * its travel distance can never drift out of sync with the track it sits
 * in:
 *
 *   thumb size   = track.block - 2 * PADDING
 *   checked start = track.inline - thumb size - PADDING
 *                 = track.inline - track.block + PADDING
 *
 * The motion is a CSS TRANSITION on `[data-checked]`, not an `@ap/motion`
 * animation — this is the one component in the library that reaches for a
 * plain transition instead. Verified in Base UI's source
 * (SwitchThumbDataAttributes.js): the thumb carries state attributes, not
 * transition-status ones, so there is no discrete enter/exit event for a
 * motion to hook — only a position that changes. The duration comes from
 * `vars.duration.fast`, not a literal: `theme.css` redefines every
 * `--ap-duration-*` token to `1ms` under `prefers-reduced-motion: reduce`
 * (theme.css:418-425), so this transition is automatically suppressed for a
 * reduced-motion user with no media query of its own — a hardcoded duration
 * would keep animating regardless of that preference, which is exactly what
 * ADR-0010 forbids.
 */
export const switchThumbRecipe = recipe({
  base: {
    '@layer': {
      [componentsLayer]: {
        boxSizing: 'border-box',
        position: 'absolute',
        insetBlockStart: PADDING,
        insetInlineStart: PADDING,
        borderRadius: t.radius,
        background: t.thumbBg,
        transitionProperty: 'inset-inline-start',
        transitionDuration: vars.duration.fast,
        transitionTimingFunction: vars.ease.out,
      },
    },
  },
  variants: {
    size: {
      sm: {
        '@layer': {
          [componentsLayer]: {
            inlineSize: `calc(${TRACK.sm.block} - ${PADDING} - ${PADDING})`,
            blockSize: `calc(${TRACK.sm.block} - ${PADDING} - ${PADDING})`,
            selectors: {
              '&[data-checked]': {
                insetInlineStart: `calc(${TRACK.sm.inline} - ${TRACK.sm.block} + ${PADDING})`,
              },
            },
          },
        },
      },
      md: {
        '@layer': {
          [componentsLayer]: {
            inlineSize: `calc(${TRACK.md.block} - ${PADDING} - ${PADDING})`,
            blockSize: `calc(${TRACK.md.block} - ${PADDING} - ${PADDING})`,
            selectors: {
              '&[data-checked]': {
                insetInlineStart: `calc(${TRACK.md.inline} - ${TRACK.md.block} + ${PADDING})`,
              },
            },
          },
        },
      },
      lg: {
        '@layer': {
          [componentsLayer]: {
            inlineSize: `calc(${TRACK.lg.block} - ${PADDING} - ${PADDING})`,
            blockSize: `calc(${TRACK.lg.block} - ${PADDING} - ${PADDING})`,
            selectors: {
              '&[data-checked]': {
                insetInlineStart: `calc(${TRACK.lg.inline} - ${TRACK.lg.block} + ${PADDING})`,
              },
            },
          },
        },
      },
    },
  },
  defaultVariants: { size: 'md' },
})
