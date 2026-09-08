'use client'

import { forwardRef, type CSSProperties } from 'react'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import type { CheckboxRootProps } from '@base-ui/react/checkbox'
import {
  checkboxIndeterminateBar,
  checkboxIndicator,
  checkboxLabelClass,
  checkboxLabelTextClass,
  checkboxRecipe,
} from './Checkbox.css.js'
import { Icon } from '../../icons/Icon.js'

export { CHECKBOX_TOKENS } from './Checkbox.tokens.js'

/**
 * `render` is deliberately not exposed, per spec §4.1.2 — this component
 * owns its own markup end to end. With no `render` prop there is nothing to
 * derive `nativeButton` from either (it only matters when `render` swaps in
 * a real `<button>`), so it is left out of the prop surface entirely rather
 * than forwarded at Base UI's default.
 */
export interface CheckboxProps
  extends Omit<CheckboxRootProps, 'className' | 'render' | 'nativeButton' | 'style'> {
  /** Size of the box. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg'
  /**
   * The visible, clickable label — and the source of the checkbox's
   * accessible name. Required, deliberately: a checkbox with no name is the
   * single most common accessibility failure, and requiring `label` makes
   * that unreachable rather than merely discouraged, the same move
   * `InputAdornment`'s `onClick` variant makes for its own `label`.
   */
  label: string
  /**
   * Neither ticked nor unticked — a mixed state, exposed as
   * `aria-checked="mixed"` rather than as a third `checked` value. Visible
   * as a bar rather than a check mark, so the state reads without relying on
   * colour (ADR-0011 §5).
   */
  indeterminate?: boolean
  className?: string
  /**
   * Narrowed to a plain style object. Base UI also accepts a
   * `(state) => CSSProperties` callback on `Checkbox.Root`, but this
   * component renders TWO elements and the callback is typed against the
   * checkbox's state — it could only ever be evaluated for one of them. So
   * the callback form is dropped rather than silently applied to whichever
   * element won, exactly as `RadioGroupRootProps` narrows its own `style`.
   */
  style?: CSSProperties
}

/**
 * This component renders two boxes a caller could plausibly mean — the outer
 * `<label>` row and the inner `<span role="checkbox">` — so the split is
 * stated here in full and pinned by `Checkbox.test.tsx`'s "props land on the
 * elements this component documents" test:
 *
 *  - **`className`, `style` and `ref` address the `<label>`.** It is the
 *    element this component renders at its root and the one carrying the row
 *    layout — the gap between box and text, the alignment, the type. Before
 *    this was decided, all three went to the inner box while the actual
 *    layout box was unreachable, so a caller's margin or width applied to the
 *    icon-sized square rather than to the row they could see. `RadioGroupItem`
 *    reached the same contract from the same defect (commit `0ab9b90`), and
 *    the wording there is deliberately the same: the three
 *    presentation/identity props never disagree about which box they mean.
 *  - **Every other prop addresses `Checkbox.Root`.** Those are Base UI's
 *    checkbox props (`name`, `value`, `checked`/`defaultChecked`,
 *    `onCheckedChange`, `disabled`, `readOnly`, `required`, `inputRef`, and
 *    this component's `indeterminate`/`size`) plus the remaining DOM
 *    passthrough — `id`, `data-*`, `aria-*`, event handlers — which travel
 *    with them so there is no hand-maintained list of prop names here to
 *    drift out of step with Base UI's own type.
 *
 * `id` in particular belongs on the control, not the label: Base UI feeds it
 * to `useLabelableId` as the hidden input's id override, so it is the
 * identity a surrounding `Field` registers this control under rather than a
 * styling hook. The hidden `<input>` a form actually posts stays reachable
 * through Base UI's own `inputRef`, forwarded untouched.
 *
 * A handler passed here still sees every event this component can raise even
 * though it sits on the inner element: all of them originate at or below the
 * control, and React's synthetic `onFocus`/`onBlur` bubble too.
 */
export const Checkbox = forwardRef<HTMLLabelElement, CheckboxProps>(function Checkbox(
  { size = 'md', label, indeterminate = false, className, style, ...rest },
  ref,
) {
  return (
    <label
      ref={ref}
      className={[checkboxLabelClass, className].filter(Boolean).join(' ')}
      // Conditionally SPREAD, never `style={style}`. Under
      // `exactOptionalPropertyTypes` an explicit `undefined` is not the same
      // as an omitted prop, and Base UI's own merge lets an explicit
      // `undefined` win — so the same discipline applies on both elements
      // even though this one is a plain host tag.
      {...(style !== undefined ? { style } : {})}
    >
      <BaseCheckbox.Root
        {...rest}
        indeterminate={indeterminate}
        className={checkboxRecipe({ size })}
      >
        <BaseCheckbox.Indicator className={checkboxIndicator}>
          {indeterminate ? (
            // A bar, not the check icon: `Checkbox.Indicator` mounts whenever
            // `checked || indeterminate` (CheckboxIndicator.js), so rendering
            // the check glyph unconditionally here would tick an
            // indeterminate box too. The `indeterminate` prop this component
            // was given (not Base UI's own internal state) decides which
            // glyph renders, so the two states never share one.
            <span aria-hidden="true" className={checkboxIndeterminateBar} />
          ) : (
            <Icon name="check" />
          )}
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      {/*
        A span, not a bare text node: the row is a flex container, and a text
        node becomes an anonymous flex item that no rule can reach. The
        label's own typography lives on this element.
      */}
      <span className={checkboxLabelTextClass}>{label}</span>
    </label>
  )
})
