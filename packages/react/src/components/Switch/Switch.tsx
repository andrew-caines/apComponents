'use client'

import { forwardRef, type CSSProperties } from 'react'
import { Switch as BaseSwitch } from '@base-ui/react/switch'
import type { SwitchRootProps } from '@base-ui/react/switch'
import {
  switchLabelClass,
  switchLabelTextClass,
  switchThumbRecipe,
  switchTrackRecipe,
} from './Switch.css.js'

export { SWITCH_TOKENS } from './Switch.tokens.js'

/**
 * `render` is deliberately not exposed, per spec §4.1.2 — same shape as
 * `Checkbox`: this component owns its own markup end to end. With no
 * `render` prop there is nothing to derive `nativeButton` from either (it
 * only matters when `render` swaps in a real `<button>`), so it is left out
 * of the prop surface entirely rather than forwarded at Base UI's default.
 */
export interface SwitchProps
  extends Omit<SwitchRootProps, 'className' | 'render' | 'nativeButton' | 'style'> {
  /** Size of the track. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg'
  /**
   * The visible, clickable label — and the source of the switch's
   * accessible name. Required, deliberately: same reasoning as `Checkbox`'s
   * `label` — a switch with no name is an accessibility failure, and
   * requiring `label` makes that unreachable rather than merely
   * discouraged.
   */
  label: string
  className?: string
  /**
   * Narrowed to a plain style object — same reasoning as `CheckboxProps`'s
   * `style`: this component renders two elements, so Base UI's
   * `(state) => CSSProperties` callback form could only ever be evaluated
   * for one of them.
   */
  style?: CSSProperties
}

/**
 * The same prop-to-element split as `Checkbox`, for the same reason, and
 * pinned by `Switch.test.tsx`'s "props land on the elements this component
 * documents" test: **`className`, `style` and `ref` address the `<label>`**,
 * the element this component renders at its root and the one carrying the
 * row layout, and **every other prop addresses `Switch.Root`** — Base UI's
 * switch props plus the remaining `id`/`data-*`/`aria-*`/handler
 * passthrough. See the longer note on `Checkbox.tsx` for why `id` in
 * particular belongs on the control rather than on the label.
 *
 * No `loading` prop, by design — do not add one.
 *
 * Base UI does not put `readOnly` on the Switch's hidden input; it enforces
 * read-only only by calling `preventDefault` inside React's `onChange`
 * handler (SwitchRoot.js), which is client-side behaviour. Before hydration
 * that handler does not exist, so a "pending" switch built on `readOnly`
 * would NOT actually be read-only in the window between server paint and
 * hydration — ADR-0011 §6.5's guarantee that a pending control stays
 * submittable does not hold here the way it does for a control whose
 * read-only state is a real HTML attribute. Task 7 documents this trap.
 */
export const Switch = forwardRef<HTMLLabelElement, SwitchProps>(function Switch(
  { size = 'md', label, className, style, ...rest },
  ref,
) {
  return (
    <label
      ref={ref}
      className={[switchLabelClass, className].filter(Boolean).join(' ')}
      // Conditionally spread — see the note on `Checkbox.tsx`'s `style`.
      {...(style !== undefined ? { style } : {})}
    >
      <BaseSwitch.Root {...rest} className={switchTrackRecipe({ size })}>
        <BaseSwitch.Thumb className={switchThumbRecipe({ size })} />
      </BaseSwitch.Root>
      {/* A span, not a bare text node — see the note on `Checkbox.tsx`. */}
      <span className={switchLabelTextClass}>{label}</span>
    </label>
  )
})
