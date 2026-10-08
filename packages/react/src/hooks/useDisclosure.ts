'use client'

import { useCallback, useMemo } from 'react'
import { useControllableState } from './useControllableState.js'

export interface UseDisclosureOptions {
  open?: boolean | undefined
  defaultOpen?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
}

export interface Disclosure {
  open: boolean
  setOpen: (open: boolean) => void
  onOpen: () => void
  onClose: () => void
  onToggle: () => void
}

/** Open/closed state, controlled or uncontrolled, with named helpers. */
export function useDisclosure(options: UseDisclosureOptions = {}): Disclosure {
  const { open: openProp, defaultOpen, onOpenChange } = options
  const [open, setState] = useControllableState<boolean>({
    ...(openProp !== undefined ? { value: openProp } : {}),
    defaultValue: defaultOpen ?? false,
    onChange: onOpenChange,
    name: 'useDisclosure',
  })
  const setOpen = useCallback((next: boolean) => setState(next), [setState])
  const onOpen = useCallback(() => setState(true), [setState])
  const onClose = useCallback(() => setState(false), [setState])
  const onToggle = useCallback(() => setState((prev) => !prev), [setState])
  return useMemo(
    () => ({ open, setOpen, onOpen, onClose, onToggle }),
    [open, setOpen, onOpen, onClose, onToggle],
  )
}
