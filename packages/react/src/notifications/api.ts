'use client'

import { emit, nextId, warnDropped } from './channel.js'
import { toPromiseOptions } from './severity.js'
import type {
  AlertOptions,
  AnnounceOptions,
  BannerOptions,
  ConfirmOptions,
  NotificationSeverity,
  ToastOptions,
  ToastPromiseOptions,
} from './types.js'

type SeverityShortcut = (titleOrOptions: string | Omit<ToastOptions, 'severity'>) => string

function show(options: ToastOptions): string {
  const id = options.id ?? nextId('toast')
  if (!emit({ kind: 'toast', options: { ...options, id } })) warnDropped('toast')
  return id
}

function shortcut(severity: NotificationSeverity): SeverityShortcut {
  return (titleOrOptions) =>
    show({
      ...(typeof titleOrOptions === 'string' ? { title: titleOrOptions } : titleOrOptions),
      severity,
    })
}

/**
 * Shows a toast and returns its id. Client-only: call it from an event handler
 * or effect, never during render or on the server. With no `NotificationProvider`
 * mounted the call is dropped (with a development warning) and still returns
 * an id. Adding with an existing `id` updates that toast in place.
 */
export const toast = Object.assign(show, {
  /** Client-only. Dropped, with a development warning, when no provider is mounted. */
  info: shortcut('info'),
  /** Client-only. Dropped, with a development warning, when no provider is mounted. */
  success: shortcut('success'),
  /** Client-only. Dropped, with a development warning, when no provider is mounted. */
  warning: shortcut('warning'),
  /** Client-only. Priority high and never auto-dismissed. Dropped when no provider is mounted. */
  error: shortcut('error'),
  /**
   * Shows a loading toast that becomes the success or error toast when the
   * promise settles. Returns the caller's own promise, unchanged: a rejection
   * still rejects for the caller. Client-only. With no `NotificationProvider`
   * mounted the toast is dropped (with a development warning) and the promise
   * is still returned.
   */
  promise<T>(promise: Promise<T>, options: ToastPromiseOptions<T>): Promise<T> {
    const delivered = emit({
      kind: 'toast-promise',
      promise,
      options: toPromiseOptions(options) as ReturnType<typeof toPromiseOptions<unknown>>,
    })
    if (!delivered) warnDropped('toast.promise')
    return promise
  },
  /**
   * Closes the toast with this id, or every toast when called with none.
   * Client-only. A no-op, with no warning, when no provider is mounted.
   */
  close(id?: string): void {
    emit({ kind: 'toast-close', ...(id !== undefined ? { id } : {}) })
  },
})

/**
 * Shows a banner and returns its id and a `close()`. Client-only: call it from
 * an event handler or effect. With no `NotificationProvider` mounted the call
 * is dropped (with a development warning) and still returns the id.
 */
export function banner(options: BannerOptions): { id: string; close(): void } {
  const id = options.id ?? nextId('banner')
  if (!emit({ kind: 'banner', options: { ...options, id } })) warnDropped('banner')
  return {
    id,
    close() {
      emit({ kind: 'banner-close', id })
    },
  }
}

/**
 * Opens a confirmation dialog and resolves `true` on confirm, `false` on
 * cancel or Escape. Client-only. With no `NotificationProvider` mounted the
 * call is dropped (with a development warning) and resolves `false`.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const delivered = emit({
      kind: 'dialog',
      request: { type: 'confirm', id: nextId('dialog'), options, resolve },
    })
    if (!delivered) {
      warnDropped('confirm')
      resolve(false)
    }
  })
}

/**
 * Opens an alert dialog and resolves when it is acknowledged. Client-only.
 * With no `NotificationProvider` mounted the call is dropped (with a
 * development warning) and resolves immediately.
 */
export function alert(options: AlertOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    const delivered = emit({
      kind: 'dialog',
      request: { type: 'alert', id: nextId('dialog'), options, resolve },
    })
    if (!delivered) {
      warnDropped('alert')
      resolve()
    }
  })
}

/**
 * Announces a message to screen readers without showing anything. Client-only.
 * With no `NotificationProvider` mounted the call is dropped (with a
 * development warning) and returns nothing. Use `'assertive'` for errors only
 * (ADR-0012); everything else stays `'polite'`, the default.
 */
export function announce(message: string, options: AnnounceOptions = {}): void {
  const delivered = emit({ kind: 'announce', message, politeness: options.politeness ?? 'polite' })
  if (!delivered) warnDropped('announce')
}
