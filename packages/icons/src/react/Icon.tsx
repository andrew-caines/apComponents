import type { ComponentType, CSSProperties } from 'react'
import { DEFAULT_VIEWBOX, HALO_STROKE, SECONDARY_OPACITY, STROKE } from '../constants.js'
import { isIconDefinition } from '../define.js'
import type { IconDefinition } from '../types.js'

/** The props a non-definition icon component (Lucide, react-icons, ...) receives. */
export type ForeignIconProps = {
  className?: string
  style?: CSSProperties
  role?: string
  'aria-label'?: string
  'aria-hidden'?: boolean
  focusable?: boolean
}

export type IconValue = IconDefinition | ComponentType<ForeignIconProps>

export interface IconProps {
  icon: IconValue
  /** Same contract as today: decorative unless labelled, never both. */
  label?: string
  /** A number is px; a string is any CSS length. Default '1em'. */
  size?: number | string
  /** Single-colour icon colour, any CSS colour. Default currentColor. */
  color?: string
  /** Presence turns duotone on. Absent or false: outline only. */
  duoTone?: boolean
  /** Outline colour while duotone is active; ignored otherwise. */
  duoTonePrimary?: string
  /** Fill colour while duotone is active, used exactly as given; ignored otherwise. Default: the primary at 40%. */
  duoToneSecondary?: string
  className?: string
}

export function Icon({
  icon,
  label,
  size = '1em',
  color,
  duoTone,
  duoTonePrimary,
  duoToneSecondary,
  className,
}: IconProps) {
  // Decorative by default (aria-hidden, no name), role="img" + aria-label when
  // a label is given, and never both. Same contract as @ap/react's Icon.
  const ariaProps =
    label !== undefined
      ? { role: 'img', 'aria-label': label }
      : { 'aria-hidden': true, focusable: false }

  // Sizing travels as `style`, never as width/height attributes: an attribute
  // does not resolve `var()`, a CSS declaration does.
  const dim = typeof size === 'number' ? `${size}px` : size

  if (!isIconDefinition(icon)) {
    const Foreign = icon
    const style: CSSProperties = {
      width: dim,
      height: dim,
      ...(color ? { color } : {}),
    }
    return (
      <Foreign
        {...(className !== undefined ? { className } : {})}
        style={style}
        {...ariaProps}
      />
    )
  }

  const def = icon
  const active = Boolean(duoTone) && def.secondary !== undefined
  const outline = active ? (duoTonePrimary ?? color) : color
  const style: CSSProperties = {
    width: dim,
    height: dim,
    ...(outline ? { color: outline } : {}),
  }

  return (
    <svg
      viewBox={def.viewBox ?? DEFAULT_VIEWBOX}
      className={className}
      style={style}
      {...ariaProps}
    >
      {active && def.secondary === 'halo' && (
        <g
          fill="none"
          stroke={duoToneSecondary ?? 'currentColor'}
          strokeOpacity={duoToneSecondary ? undefined : SECONDARY_OPACITY}
          strokeWidth={HALO_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {def.primary.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      )}
      {active && Array.isArray(def.secondary) && (
        <g
          fill={duoToneSecondary ?? 'currentColor'}
          fillOpacity={duoToneSecondary ? undefined : SECONDARY_OPACITY}
          stroke="none"
        >
          {(def.secondary as readonly string[]).map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      )}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {def.primary.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  )
}
