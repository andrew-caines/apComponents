'use client'

import type { ToastManagerAddOptions, ToastManagerPromiseOptions } from '@base-ui/react/toast'
import type { IconName } from '../icons/paths.js'
import type { NotificationSeverity, ToastOptions, ToastPromiseOptions } from './types.js'

/** The glyph for each severity, shared by toasts and banners. */
export const SEVERITY_ICON: Record<NotificationSeverity, IconName> = {
  info: 'info',
  success: 'check-circle',
  warning: 'alert-triangle',
  error: 'alert-circle',
}

const DEFAULT_TIMEOUT = 5000

/**
 * Base UI add-options for a toast. Severity decides priority: `error` is
 * priority 'high' (role alertdialog, announced assertively) with timeout 0,
 * always, so a caller's timeout cannot make an error vanish. Every other
 * severity is priority 'low' and times out after `timeout ?? 5000`.
 */
export function toBaseToast(options: ToastOptions): ToastManagerAddOptions<object> {
  const severity = options.severity ?? 'info'
  const isError = severity === 'error'
  return {
    ...(options.id !== undefined ? { id: options.id } : {}),
    title: options.title,
    ...(options.description !== undefined ? { description: options.description } : {}),
    type: severity,
    priority: isError ? 'high' : 'low',
    timeout: isError ? 0 : (options.timeout ?? DEFAULT_TIMEOUT),
    ...(options.action
      ? { actionProps: { children: options.action.label, onClick: options.action.onClick } }
      : {}),
  }
}

type UpdateOptions = Exclude<ToastManagerPromiseOptions<unknown, object>['loading'], string>
type Resolved = string | Omit<ToastOptions, 'id'>
type Branch = 'loading' | 'success' | 'error'

function toUpdate(value: Resolved, branch: Branch): UpdateOptions {
  const base = typeof value === 'string' ? { title: value } : value
  if (branch === 'loading') {
    // Base UI owns the loading toast's type, and it never times out.
    // Each key is spread only when set, as in toBaseToast: an explicit
    // `undefined` never reaches Base UI's update.
    const { title, description } = base as Omit<ToastOptions, 'id'>
    return { title, ...(description !== undefined ? { description } : {}) }
  }
  // The error branch is forced through severity 'error', whatever the caller gave.
  const severity = branch === 'error' ? 'error' : ((base as Omit<ToastOptions, 'id'>).severity ?? 'success')
  return toBaseToast({ ...base, severity })
}

function resolveBranch<A extends unknown[]>(
  option: Resolved | ((...args: A) => Resolved),
  branch: Branch,
): UpdateOptions | ((...args: A) => UpdateOptions) {
  if (typeof option === 'function') return (...args: A) => toUpdate(option(...args), branch)
  return toUpdate(option, branch)
}

/**
 * For toast.promise. A string becomes `{ title }` (Base UI would make it a
 * description). The error branch is always forced through severity 'error'
 * (priority 'high', timeout 0), because Base UI's own promise handling leaves
 * priority alone and would make the failure polite and auto-dismissing.
 */
export function toPromiseOptions<T>(
  options: ToastPromiseOptions<T>,
): ToastManagerPromiseOptions<T, object> {
  return {
    loading: resolveBranch(options.loading as Resolved, 'loading') as UpdateOptions,
    success: resolveBranch(options.success, 'success'),
    error: resolveBranch(options.error, 'error'),
  }
}
