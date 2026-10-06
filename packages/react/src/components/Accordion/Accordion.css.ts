import { style } from '@vanilla-extract/css'
import { cssVarName } from '@ap/motion'
import { vars } from '../../theme/contract.css.js'
import { componentsLayer } from '../../theme/layers.css.js'
import { ACCORDION_TOKENS as t } from './Accordion.tokens.js'

/** One item. A hairline on its block end separates it from the next item. */
export const accordionItemClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      selectors: {
        '&:not(:last-child)': { borderBlockEnd: `1px solid ${t.itemBorder}` },
      },
    },
  },
})

/**
 * The heading around a trigger. Only the UA heading margin is reset; the
 * trigger inside carries all the type, so the heading level (swapped through
 * `render`) never changes how an item looks.
 */
export const accordionHeaderClass = style({
  '@layer': { [componentsLayer]: { boxSizing: 'border-box', margin: 0 } },
})

/**
 * The trigger: a full-width row with its label at the start and the chevron
 * at the end.
 *
 * Hover skips a disabled trigger (`[data-disabled]`,
 * `accordion/trigger/AccordionTriggerDataAttributes.d.ts`). It does not skip
 * an open one: the open state (`[data-panel-open]`, same file) sets no
 * background of its own, so there is no state rule for the hover to outrank.
 *
 * The focus ring is `outline`, never `boxShadow`, as on `Input.css.ts`.
 */
export const accordionTriggerClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: vars.space['3'],
      inlineSize: '100%',
      margin: 0,
      border: 0,
      paddingBlock: vars.space['3'],
      paddingInline: vars.space['4'],
      background: 'transparent',
      borderRadius: t.radius,
      fontFamily: vars.font.body,
      fontSize: vars.text.md.size,
      lineHeight: vars.text.md.lineHeight,
      fontWeight: vars.font.weightSemibold,
      textAlign: 'start',
      color: t.text,
      cursor: 'pointer',
      selectors: {
        '&:hover:not([data-disabled])': { background: t.triggerHoverBg },
        '&:focus-visible': {
          outlineWidth: vars.misc.focusRingWidth,
          outlineStyle: 'solid',
          outlineColor: t.focusRing,
          outlineOffset: vars.misc.focusRingOffset,
        },
        '&[data-disabled]': { cursor: 'default', opacity: 0.6 },
      },
    },
  },
})

/**
 * The chevron the trigger owns. It turns half a revolution while the
 * trigger's panel is open: Base UI sets `[data-panel-open]` on the trigger
 * only then (`utils/collapsibleOpenStateMapping.js:15-23`, applied at
 * `accordion/trigger/AccordionTrigger.js:71`).
 *
 * The turn is a TRANSITION on `rotate`, as `Switch.css.ts`'s thumb moves by
 * one: the trigger carries a state attribute, not a transition status, so a
 * changing angle is all there is to animate. `vars.duration.fast` is cut to
 * 1ms under reduced motion by `theme.css`, so it needs no media query here.
 */
export const accordionChevronClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      flexShrink: 0,
      color: t.chevron,
      transitionProperty: 'rotate',
      transitionDuration: vars.duration.fast,
      transitionTimingFunction: vars.ease.out,
      selectors: {
        '[data-panel-open] > &': { rotate: '180deg' },
      },
    },
  },
})

/**
 * The panel. `@ap/motion`'s `expand` and `collapse` animate `height` from and
 * to `--panel-height` (`packages/motion/src/motions.ts`); Base UI writes the
 * measured height to `--accordion-panel-height`
 * (`accordion/panel/AccordionPanelCssVars.js:12`, set at
 * `accordion/panel/AccordionPanel.js:109`), so the panel aliases one to the
 * other (§4.1.5).
 *
 * `expand` runs on `[data-open]`, not `[data-starting-style]`: Base UI holds
 * the starting status for one frame only
 * (`internals/useTransitionStatus.js:61-63`), and dropping the attribute
 * would cut a keyframe animation short. `[data-open]` stays for the whole
 * open state. A panel that is open on mount does not replay it: Base UI sets
 * `animationName: 'none'` then (`accordion/panel/AccordionPanel.js:117-121`).
 * `collapse` runs on `[data-ending-style]`, which lasts until the close
 * animation finishes (`collapsible/panel/useCollapsiblePanel.js:242-269`).
 * The panel has no transition: Base UI treats a panel with both as a
 * transition and warns (`useCollapsiblePanel.js:324-329`).
 *
 * `overflow: hidden` is always on, not only while animating: an expand
 * outlives `[data-starting-style]` by the whole duration, and no attribute
 * marks the rest of it. Once open, Base UI resets the height to `auto`, so
 * the clip then cuts nothing. The padding lives on the owned content box
 * inside, for the same reason: a panel's own padding would stop `collapse`
 * short of zero height.
 *
 * The panel never sets `display`, which would beat the UA `[hidden]` rule on
 * a kept-mounted closed panel.
 */
export const accordionPanelClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      vars: { '--panel-height': 'var(--accordion-panel-height)' },
      overflow: 'hidden',
      selectors: {
        '&[data-open]': { animation: `var(${cssVarName('expand')})` },
        '&[data-ending-style]': { animation: `var(${cssVarName('collapse')})` },
      },
    },
  },
})

/**
 * The panel's content box: inline padding to line up with the trigger's
 * label, and room on the block end before the next item's hairline.
 */
export const accordionPanelContentClass = style({
  '@layer': {
    [componentsLayer]: {
      boxSizing: 'border-box',
      paddingInline: vars.space['4'],
      paddingBlockEnd: vars.space['4'],
    },
  },
})
