'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { DEFAULT_MESSAGES, type MessageKey, type Messages } from './messages.js'

export interface LocaleContextValue {
  locale: string
  /** Undefined means "resolve on the client", per ADR-0012's two-pass rule. */
  timeZone?: string | undefined
  currency: string
  messages: Readonly<Record<MessageKey, string>>
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export interface LocaleProviderProps {
  locale?: string
  timeZone?: string
  currency?: string
  messages?: Messages
  children: ReactNode
}

/**
 * There is deliberately NO auto-detection from `navigator`. The server has no
 * `navigator`, so auto-detection is exactly what breaks under SSR — the server
 * would pick one locale and the client another, and the markup would not match.
 */
export function LocaleProvider({
  locale = 'en-US',
  timeZone,
  currency = 'USD',
  messages,
  children,
}: LocaleProviderProps) {
  const value = useMemo<LocaleContextValue>(() => {
    const merged = { ...DEFAULT_MESSAGES } as Record<MessageKey, string>
    for (const key of Object.keys(DEFAULT_MESSAGES) as MessageKey[]) {
      const override = messages?.[key]
      // An explicitly-undefined override must not blank the string: a missing
      // translation falls back to English rather than rendering nothing.
      if (typeof override === 'string') merged[key] = override
    }
    return { locale, timeZone, currency, messages: Object.freeze(merged) }
  }, [locale, timeZone, currency, messages])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used inside <LocaleProvider> (or <ApProvider>).')
  }
  return ctx
}

export function useMessages(): Readonly<Record<MessageKey, string>> {
  return useLocale().messages
}
