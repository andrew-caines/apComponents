'use client'

import { createContext } from 'react'

/** Private. True inside a NotificationProvider, so a nested one can step aside. */
export const NotificationContext = createContext(false)
