'use client'

import { useCallback, useState } from 'react'
import { useTimeout } from '@base-ui/utils/useTimeout'

export interface UseCopyToClipboardOptions {
  /** How long `copied` stays true. Defaults to 2000. */
  resetMs?: number | undefined
}

/**
 * Copies text to the clipboard. `copy` resolves `true` on success and `false`
 * when the clipboard is unavailable or the write is refused; it never
 * rejects. `copied` is true for `resetMs` after a success, and a second copy
 * inside that window restarts it.
 */
export function useCopyToClipboard(
  options?: UseCopyToClipboardOptions,
): [copied: boolean, copy: (text: string) => Promise<boolean>] {
  const resetMs = options?.resetMs ?? 2000
  const [copied, setCopied] = useState(false)
  const timeout = useTimeout()
  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        if (typeof navigator === 'undefined' || !navigator.clipboard) return false
        await navigator.clipboard.writeText(text)
      } catch {
        return false
      }
      setCopied(true)
      timeout.start(resetMs, () => setCopied(false))
      return true
    },
    [resetMs, timeout],
  )
  return [copied, copy]
}
