'use client'

import type { CSSProperties } from 'react'
import { vars } from '../theme/contract.css.js'
import { useIconOverrides } from './IconProvider.js'
import { ICON_PATHS, type IconName } from './paths.js'

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export interface IconProps {
  name: IconName
  /**
   * Give a label ONLY when the icon carries meaning on its own. Without one the
   * icon is decorative and hidden from assistive technology, which is right when
   * adjacent text already says what it means.
   */
  label?: string
  /**
   * A named step reads `var(--ap-icon-<name>)` off the icon scale (all `em`,
   * so the icon tracks its context's font size). A number is an escape hatch
   * for a one-off pixel size and resolves to `${n}px`.
   *
   * The steps are multipliers, not absolute sizes, so they do NOT correspond
   * to the text step of the same name: `lg` inside `lg` text renders at
   * 1.25 x 20px = 25px, because both scale. The default `md` is `1em` and so
   * matches the text beside it at any size — name another step only when the
   * icon should differ from that text on purpose. See examples/scales.
   */
  size?: IconSize | number
  className?: string
}

function resolveSize(size: IconSize | number): string {
  return typeof size === 'number' ? `${size}px` : vars.icon[size]
}

export function Icon({ name, label, size = 'md', className }: IconProps) {
  const Override = useIconOverrides()[name]
  const meaningful = label !== undefined
  // Decorative by default (aria-hidden, no name), role="img" + aria-label
  // when a label is given, and never both — computed once so the override
  // branch and the built-in branch apply the exact same contract (F2).
  const ariaProps = meaningful
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': true, focusable: false }

  // Sizing travels as a `style` declaration, never as a `width`/`height`
  // presentation attribute: an attribute takes a length and does not resolve
  // `var()` — `<svg width="var(--ap-icon-md)">` is simply invalid — while a
  // CSS declaration does. `style` also wins the cascade over a presentation
  // attribute, which is what lets an override component size correctly with
  // no size-translating adapter (verified against react-icons@5.7.0, whose
  // `IconBase` spreads `props.style` last into its own style object while
  // setting `width`/`height` as attributes from its own `size` prop).
  const dimension = resolveSize(size)
  const style: CSSProperties = { width: dimension, height: dimension }

  if (Override) {
    // Spread conditionally rather than `className={className}`: under
    // exactOptionalPropertyTypes, `ComponentType<{ className?: string }>`
    // does not accept an EXPLICIT `undefined` for an optional prop, only the
    // prop being omitted entirely.
    return (
      <Override
        {...(className !== undefined ? { className } : {})}
        style={style}
        {...ariaProps}
      />
    )
  }

  return (
    <svg
      className={className}
      style={style}
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
