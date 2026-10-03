'use client'

import type { ReactNode } from 'react'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { IconProvider, type IconOverrides } from '../icons/index.js'
import { LocaleProvider, type LocaleProviderProps } from './LocaleProvider.js'
import { ThemeProvider, type ThemeProviderProps } from './ThemeProvider.js'

export interface ApProviderProps
  extends Omit<ThemeProviderProps, 'children'>,
    Omit<LocaleProviderProps, 'children'> {
  icons?: IconOverrides
  children: ReactNode
}

/**
 * Composes the stack so the common case is one component.
 *
 * ADR-0012 specifies four providers. `NotificationProvider` arrives in Phase 5
 * with Toast, which three of its four surfaces are built on. It slots in here
 * with NO public API change.
 *
 * It also wraps the tree in Base UI's tooltip provider with its defaults, so
 * tooltips across the app share their delay: once one has opened, moving to
 * another opens it at once. The provider renders no DOM. It is imported from
 * Base UI directly, not from `TooltipParts`, so an app using `ApProvider`
 * without `Tooltip` does not pull in Tooltip's stylesheet.
 */
export function ApProvider({
  scheme,
  defaultScheme,
  storageKey,
  theme,
  locale,
  timeZone,
  currency,
  messages,
  icons,
  children,
}: ApProviderProps) {
  return (
    <ThemeProvider
      {...(scheme !== undefined ? { scheme } : {})}
      {...(defaultScheme !== undefined ? { defaultScheme } : {})}
      {...(storageKey !== undefined ? { storageKey } : {})}
      {...(theme !== undefined ? { theme } : {})}
    >
      <LocaleProvider
        {...(locale !== undefined ? { locale } : {})}
        {...(timeZone !== undefined ? { timeZone } : {})}
        {...(currency !== undefined ? { currency } : {})}
        {...(messages !== undefined ? { messages } : {})}
      >
        <IconProvider {...(icons !== undefined ? { icons } : {})}>
          <BaseTooltip.Provider>{children}</BaseTooltip.Provider>
        </IconProvider>
      </LocaleProvider>
    </ThemeProvider>
  )
}
