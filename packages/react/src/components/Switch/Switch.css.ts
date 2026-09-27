import { style } from '@vanilla-extract/css'
import { recipe } from '@vanilla-extract/recipes'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { SWITCH_TOKENS as t } from './Switch.tokens.js'

/**
 * The clickable row: the `<label>` wrapping the track and the label text, and
 * the element this component renders at its root.
 *
 * Identical declarations to `checkboxLabelClass`, reading from this
 * component's own tokens — a `Switch` and a `Checkbox` stacked in one form
 * have to line up, and the two token sets carry the same values for exactly
 * that reason (see `Switch.tokens.ts`).
 *
 * `align-items: flex-start`, not `center`: a label that wraps to two lines
 * should keep its track beside the FIRST line rather than floating it against
 * the middle of the block. Same choice as `radioGroupOptionClass`.
 *
 * No `cursor` here, deliberately — the pointer lives on the TRACK, which is
 * also the element that flips to `cursor: default` under `[data-disabled]`.
 * See the longer note on `Checkbox.css.ts`.
 */
export const switchLabelClass = style({
  '@layer': {
    [componentsLayer]: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: t.labelGap,
      fontFamily: vars.font.body,
    },
  },
})

/** The label's own text, inside the `<label>` and beside the track. */
export const switchLabelTextClass = style({
  '@layer': {
    [componentsLayer]: {
      color: t.labelText,
      fontSize: t.labelSize,
      lineHeight: t.labelLineHeight,
    },
  },
})

/**
 * The gap between the track's edge and the thumb, on every side, at every
 * size — a single space-scale token rather than a per-size value, so the
 * thumb-size and checked-position formulas below only have ONE size-driven
 * input (the track's own dimensions) instead of two independent scales that
 * could drift out of sync.
 */
const PADDING = vars.space['1']

/**
 * The track's border width — task 8 (spec §4.1.10). Matches `Checkbox`'s
 * `borderWidth: '1px'` literal exactly, so a `Switch` and a `Checkbox` in the
 * same form read as the same stroke weight.
 *
 * Every inset in `switchThumbRecipe` below subtracts this. `switchTrackRecipe`
 * is `boxSizing: 'border-box'`, so adding a border does not change the
 * track's own OUTER footprint (`inlineSize`/`blockSize` still mean the same
 * thing). But the thumb is `position: absolute` inside the track's
 * `position: relative`, and an absolutely positioned box's insets resolve
 * against its containing block's PADDING edge, not its border edge — moving a
 * border from 0 to `BORDER_WIDTH` shifts that reference edge inward by
 * `BORDER_WIDTH` on every side while the track's painted outer edge stays
 * put. Left uncompensated, every inset below would land `BORDER_WIDTH`
 * further from the track's visible edge than before this task, silently
 * shrinking the thumb's travel. Subtracting `BORDER_WIDTH` from each inset
 * cancels that shift, so the thumb's travel and edge gaps are pixel-identical
 * to what they were with no border at all.
 */
const BORDER_WIDTH = '1px'

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
 * The track: `Switch.Root`, a `<span role="switch">`. Its OFF look is
 * carried by `trackBg` on the base rule, and the `[data-checked]` selector
 * below swaps it for `trackBgChecked` — Base UI's own state attribute
 * (SwitchRootDataAttributes), never one of our own invention.
 *
 * As of task 8 (spec §4.1.10) the track also carries a real `border`, at
 * rest, on hover, and invalid — the same three roles `Checkbox` already
 * carries, brought onto the same names/fallbacks so a form mixing the two
 * controls reads as one system. `borderWidth`/`borderStyle` are set here on
 * the base rule rather than per-selector, because every state shares the
 * same width and style and only the colour changes.
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
        borderStyle: 'solid',
        borderWidth: BORDER_WIDTH,
        borderColor: t.border,
        borderRadius: t.radius,
        cursor: 'pointer',
        selectors: {
          // Order matches Checkbox.css.ts: hover, then focus-visible, then
          // checked, then invalid, then disabled.
          '&:hover:not([data-disabled])': {
            borderColor: t.borderHover,
          },
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
          // Base UI's own state attribute, reaching the track ambiently
          // through Field context — the same mechanism Input and Checkbox
          // already rely on. This is the rule Switch lacked before task 8.
          '&[data-invalid]': {
            borderColor: t.borderInvalid,
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
 * Task 8 (spec §4.1.10) added a real `border` to the track (see
 * `BORDER_WIDTH` above). Every inset below now subtracts `BORDER_WIDTH` —
 * `insetBlockStart`/`insetInlineStart` (rest) become `PADDING - BORDER_WIDTH`,
 * and the checked `insetInlineStart` becomes
 * `track.inline - track.block + PADDING - BORDER_WIDTH` — because an
 * absolutely positioned child's insets resolve against the containing
 * block's PADDING edge, and adding a border moves that edge inward by
 * `BORDER_WIDTH` while the track's own painted (border-box) footprint stays
 * the declared `TRACK` size. Without the subtraction the thumb would still
 * be the same SIZE but would sit `BORDER_WIDTH` further from the track's
 * visible edge at both ends — shrinking the visible travel by
 * `2 * BORDER_WIDTH`. The thumb's SIZE formula is untouched: it depends only
 * on `track.block` and `PADDING`, neither of which this task changed.
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
        insetBlockStart: `calc(${PADDING} - ${BORDER_WIDTH})`,
        insetInlineStart: `calc(${PADDING} - ${BORDER_WIDTH})`,
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
                insetInlineStart: `calc(${TRACK.sm.inline} - ${TRACK.sm.block} + ${PADDING} - ${BORDER_WIDTH})`,
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
                insetInlineStart: `calc(${TRACK.md.inline} - ${TRACK.md.block} + ${PADDING} - ${BORDER_WIDTH})`,
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
                insetInlineStart: `calc(${TRACK.lg.inline} - ${TRACK.lg.block} + ${PADDING} - ${BORDER_WIDTH})`,
              },
            },
          },
        },
      },
    },
  },
  defaultVariants: { size: 'md' },
})
