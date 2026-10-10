'use client'

import type { ReactNode } from 'react'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { ToastPlacement } from '../components/Toast/ToastParts.js'
import { IconProvider, type IconOverrides } from '../icons/index.js'
import { NotificationProvider } from '../notifications/NotificationProvider.js'
import { LocaleProvider, type LocaleProviderProps } from './LocaleProvider.js'
import { ThemeProvider, type ThemeProviderProps } from './ThemeProvider.js'

export interface ApProviderProps
  extends Omit<ThemeProviderProps, 'children'>,
    Omit<LocaleProviderProps, 'children'> {
  icons?: IconOverrides
  /** Where toasts dock. Defaults to `bottom-end`. */
  notifications?: { placement?: ToastPlacement | undefined } | undefined
  children: ReactNode
}

/**
 * Composes the stack so the common case is one component.
 *
 * ADR-0012 specifies four providers, and the fourth has arrived:
 * `NotificationProvider` sits inside `IconProvider`, because toasts and the
 * dialog host read messages and icons. It adds one optional, additive prop,
 * `notifications={{ placement }}` (spec section 4.6.1).
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
  notifications,
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
          <NotificationProvider
            {...(notifications?.placement !== undefined
              ? { placement: notifications.placement }
              : {})}
          >
            <BaseTooltip.Provider>{children}</BaseTooltip.Provider>
          </NotificationProvider>
        </IconProvider>
      </LocaleProvider>
    </ThemeProvider>
  )
}
