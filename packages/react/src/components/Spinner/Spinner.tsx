'use client'

import type { CSSProperties } from 'react'
import { vars } from '../../theme/contract.css.js'
import type { IconSize } from '../../icons/Icon.js'
import { spinnerClass } from './Spinner.css.js'
import { SPINNER_TOKENS as t } from './Spinner.tokens.js'

export { SPINNER_TOKENS } from './Spinner.tokens.js'

export interface SpinnerProps {
  /**
   * Give a label ONLY when the spinner is the sole indication that something
   * is happening. Without one it is decorative and hidden from assistive
   * technology — which is right whenever the surrounding control already says
   * so, as `Input`'s `loading` does with `aria-busy`. Two announcements for one
   * state is noise, not redundancy.
   */
  label?: string
  /**
   * A named step off the icon scale (all `em`, so the spinner tracks its
   * context's font size), or a number for a one-off pixel size. Defaults to
   * `md` — 1em — which matches the text beside it at any size. Same contract
   * as `Icon`.
   */
  size?: IconSize | number
  className?: string
}

/**
 * An indeterminate progress indicator.
 *
 * Draws with `currentColor`, so it takes the colour of whatever it sits in
 * with no prop to pass — inside `Input`'s adornment slot it picks up the icon
 * colour, inside a button it picks up the label colour.
 *
 * The arc is deliberately open at one side. A complete ring rotating is
 * indistinguishable from a static one, which is the classic way a spinner ends
 * up conveying nothing at all.
 */
export function Spinner({ label, size = 'md', className }: SpinnerProps) {
  const meaningful = label !== undefined
  // Decorative by default, named when it carries the meaning alone, and never
  // both — the same contract Icon applies, spelled the same way so the two
  // cannot drift apart.
  const ariaProps = meaningful
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': true, focusable: false }

  // Sizing travels as a `style` declaration, never as a width/height
  // presentation attribute: an attribute takes a length and does not resolve
  // `var()`, so `<svg width="var(--ap-icon-md)">` is simply invalid. See the
  // longer note in Icon.tsx.
  const dimension = typeof size === 'number' ? `${size}px` : vars.icon[size]
  const style: CSSProperties = { width: dimension, height: dimension }

  return (
    <svg
      className={[spinnerClass, className].filter(Boolean).join(' ')}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      {...ariaProps}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth={t.width}
        strokeDasharray={t.dash}
        strokeLinecap="round"
      />
    </svg>
  )
}
