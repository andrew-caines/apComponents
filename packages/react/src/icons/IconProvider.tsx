'use client'

import { createContext, useContext, type ComponentType, type ReactNode } from 'react'
import type { IconName } from './paths.js'

export type IconOverrides = Partial<Record<IconName, ComponentType<{ className?: string }>>>

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
