'use client'

import { forwardRef } from 'react'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import type { CheckboxRootProps } from '@base-ui/react/checkbox'
import { checkboxRecipe, checkboxIndicator, checkboxIndeterminateBar } from './Checkbox.css.js'
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
  extends Omit<CheckboxRootProps, 'className' | 'render' | 'nativeButton'> {
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
}

export const Checkbox = forwardRef<HTMLElement, CheckboxProps>(function Checkbox(
  { size = 'md', label, indeterminate = false, className, ...rest },
  ref,
) {
  return (
    <label>
      <BaseCheckbox.Root
        {...rest}
        indeterminate={indeterminate}
        ref={ref}
        className={[checkboxRecipe({ size }), className].filter(Boolean).join(' ')}
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
      {label}
    </label>
  )
})
