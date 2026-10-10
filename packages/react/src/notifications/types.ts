'use client'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

/** A toast action closes its toast after `onClick` runs; a banner action does not close its banner. */
export interface NotificationAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  title: string
  description?: string | undefined
  /** Defaults to 'info'. */
  severity?: NotificationSeverity | undefined
  action?: NotificationAction | undefined
  /** Adding with an existing id updates that toast in place. */
  id?: string | undefined
  /** Milliseconds before auto-dismiss. Ignored when severity is 'error'. */
  timeout?: number | undefined
}

export type ToastPromiseOption<T> =
  | string
  | Omit<ToastOptions, 'id'>
  | ((value: T) => string | Omit<ToastOptions, 'id'>)

export interface ToastPromiseOptions<T> {
  loading: ToastPromiseOption<void>
  success: ToastPromiseOption<T>
  error: ToastPromiseOption<unknown>
}

export interface BannerOptions {
  title: string
  description?: string | undefined
  severity?: NotificationSeverity | undefined
  action?: NotificationAction | undefined
  id?: string | undefined
  dismissible?: boolean | undefined
}

export interface ConfirmOptions {
  title: string
  description?: string | undefined
  confirmLabel?: string | undefined
  cancelLabel?: string | undefined
  tone?: 'default' | 'danger' | undefined
}

export interface AlertOptions {
  title: string
  description?: string | undefined
  okLabel?: string | undefined
}

export type DialogRequest =
  | { type: 'confirm'; id: string; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { type: 'alert'; id: string; options: AlertOptions; resolve: () => void }

export interface AnnounceOptions {
  politeness?: 'polite' | 'assertive' | undefined
}
