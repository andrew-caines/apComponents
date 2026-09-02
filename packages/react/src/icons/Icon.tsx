'use client'

import { useIconOverrides } from './IconProvider.js'
import { ICON_PATHS, type IconName } from './paths.js'

export interface IconProps {
  name: IconName
  /**
   * Give a label ONLY when the icon carries meaning on its own. Without one the
   * icon is decorative and hidden from assistive technology, which is right when
   * adjacent text already says what it means.
   */
  label?: string
  /** Rendered size in px. Defaults to 1em-equivalent at 16. */
  size?: number
  className?: string
}

export function Icon({ name, label, size = 16, className }: IconProps) {
  const Override = useIconOverrides()[name]
  const meaningful = label !== undefined
  // Decorative by default (aria-hidden, no name), role="img" + aria-label
  // when a label is given, and never both — computed once so the override
  // branch and the built-in branch apply the exact same contract (F2).
  const ariaProps = meaningful
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': true, focusable: false }

  if (Override) {
    // Spread conditionally rather than `className={className}`: under
    // exactOptionalPropertyTypes, `ComponentType<{ className?: string }>`
    // does not accept an EXPLICIT `undefined` for an optional prop, only the
    // prop being omitted entirely.
    return (
      <Override
        {...(className !== undefined ? { className } : {})}
        width={size}
        height={size}
        {...ariaProps}
      />
    )
  }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...ariaProps}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}
