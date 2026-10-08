'use client'

import { useContext } from 'react'
import { announce } from '../notifications/api.js'
import { NotificationContext } from '../notifications/context.js'

/**
 * Returns `announce`, which writes to the polite or assertive live region the
 * `NotificationProvider` renders. Throws outside one, so a missing provider is
 * found in development and not by a silent screen-reader gap. The function is
 * module-level and therefore stable.
 */
export function useAnnounce(): typeof announce {
  if (!useContext(NotificationContext)) {
    throw new Error('useAnnounce must be used inside <NotificationProvider> (or <ApProvider>).')
  }
  return announce
}
