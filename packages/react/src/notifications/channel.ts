'use client'

import type { ToastManagerPromiseOptions } from '@base-ui/react/toast'
import type { BannerOptions, DialogRequest, ToastOptions } from './types.js'

export type NotificationEvent =
  | { kind: 'toast'; options: ToastOptions & { id: string } }
  | { kind: 'toast-close'; id?: string }
  | {
      kind: 'toast-promise'
      promise: Promise<unknown>
      options: ToastManagerPromiseOptions<unknown, object>
    }
  | { kind: 'banner'; options: BannerOptions & { id: string } }
  | { kind: 'banner-close'; id: string }
  | { kind: 'dialog'; request: DialogRequest }
  | { kind: 'announce'; message: string; politeness: 'polite' | 'assertive' }

type Listener = (event: NotificationEvent) => void

const listeners = new Set<Listener>()
let warnedDuplicate = false
let counter = 0

/** Returns true when at least one listener received the event. */
export function emit(event: NotificationEvent): boolean {
  if (listeners.size === 0) return false
  for (const listener of [...listeners]) listener(event)
  return true
}

export function subscribe(listener: Listener): () => void {
  // StrictMode's effect replay unsubscribes before it re-subscribes, so only a
  // genuine second subscriber (a sibling tree) sees a non-empty set.
  if (listeners.size > 0 && !warnedDuplicate) {
    warnedDuplicate = true
    // A bare `process.env.NODE_ENV` check: see the comment on the dev warning in Select.tsx.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Two NotificationProviders are mounted in separate trees, so every notification will be delivered twice. ' +
          'Mount one NotificationProvider near the root.',
      )
    }
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Ids come from a module counter, never a clock or a random source (SSR safety). */
export function nextId(prefix: 'toast' | 'banner' | 'dialog'): string {
  counter += 1
  return `ap-${prefix}-${counter}`
}

/** Development-only warning for a call made with no NotificationProvider mounted. */
export function warnDropped(fn: string): void {
  // A bare `process.env.NODE_ENV` check, never guarded by `typeof process`:
  // see the comment on the dev warning in Select.tsx.
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `${fn}() was called with no NotificationProvider mounted, so it was dropped. ` +
        'Render <NotificationProvider> (ApProvider includes one) above the caller.',
    )
  }
}
