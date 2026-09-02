'use client'

import { createContext, useContext, type ComponentType, type ReactNode } from 'react'
import type { IconName } from './paths.js'

/**
 * An override must accept exactly the props the built-in svg receives so the
 * accessibility contract survives the swap: `className`/`width`/`height` for
 * layout, and `role`/`aria-label`/`aria-hidden`/`focusable` so a labelled icon
 * still gets an accessible name and an unlabelled one is still hidden from
 * assistive technology (F2). All optional — `Icon` decides per render which
 * of the aria props to pass, never both `aria-label` and `aria-hidden`.
 */
export type IconOverrides = Partial<
  Record<
    IconName,
    ComponentType<{
      className?: string
      width?: number
      height?: number
      role?: string
      'aria-label'?: string
      'aria-hidden'?: boolean
      focusable?: boolean
    }>
  >
>

const IconContext = createContext<IconOverrides>({})

/**
 * Maps our icon names onto a product's own icon library in one place. A product
 * standardised on Lucide maps once and never thinks about it again (ADR-0012).
 *
 * The default is an empty object rather than null: `Icon` works with no provider,
 * so there is nothing to throw about.
 */
export function IconProvider({
  icons = {},
  children,
}: {
  icons?: IconOverrides
  children: ReactNode
}) {
  return <IconContext.Provider value={icons}>{children}</IconContext.Provider>
}

export function useIconOverrides(): IconOverrides {
  return useContext(IconContext)
}
