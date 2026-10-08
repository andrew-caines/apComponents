'use client'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

export interface NotificationAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  title: string
  description?: string
  /** Defaults to 'info'. */
  severity?: NotificationSeverity
  action?: NotificationAction
  /** Adding with an existing id updates that toast in place. */
  id?: string
  /** Milliseconds before auto-dismiss. Ignored when severity is 'error'. */
  timeout?: number
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
  description?: string
  severity?: NotificationSeverity
  action?: NotificationAction
  id?: string
  dismissible?: boolean
}

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

export interface AlertOptions {
  title: string
  description?: string
  okLabel?: string
}

export type DialogRequest =
  | { type: 'confirm'; id: string; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { type: 'alert'; id: string; options: AlertOptions; resolve: () => void }

export interface AnnounceOptions {
  politeness?: 'polite' | 'assertive'
}
