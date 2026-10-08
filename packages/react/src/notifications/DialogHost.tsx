'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Button } from '../components/Button/Button.js'
import {
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogHeadings,
  DialogDescription,
  DialogPopup,
  DialogTitle,
  DialogViewport,
} from '../components/Dialog/DialogParts.js'
import { useMessages } from '../providers/LocaleProvider.js'
import type { DialogRequest } from './types.js'

/** Answers a request: false for a confirm, nothing for an alert. */
function dismiss(request: DialogRequest) {
  if (request.type === 'confirm') request.resolve(false)
  else request.resolve()
}

/**
 * The FIFO queue behind the host. It lives in a ref, with a reducer to
 * re-render, so `enqueue` is stable and needs no passive effect to have run
 * (a `dialog` event can arrive from a layout effect before the host's own
 * effects). On unmount every pending request is answered, so no promise hangs.
 */
export function useDialogQueue() {
  const queue = useRef<DialogRequest[]>([])
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  const enqueue = useCallback((request: DialogRequest) => {
    queue.current = [...queue.current, request]
    rerender()
  }, [])

  const shift = useCallback(() => {
    queue.current = queue.current.slice(1)
    rerender()
  }, [])

  // StrictMode replays effects (cleanup, then setup) in development. Dismissing
  // inside the cleanup would answer a request raised by a child's mount effect,
  // which production never does. So the cleanup only schedules the dismissal,
  // and a re-run of the effect cancels it: only a real unmount lets it fire.
  const unmounting = useRef(false)
  useEffect(() => {
    unmounting.current = false
    return () => {
      unmounting.current = true
      queueMicrotask(() => {
        if (!unmounting.current) return
        const pending = queue.current
        queue.current = []
        for (const request of pending) dismiss(request)
      })
    }
  }, [])

  return { head: queue.current[0], enqueue, shift }
}

/**
 * Renders the head of the queue as an AlertDialog. Answering resolves the
 * promise at once and closes; the head is shifted only when the exit motion
 * is complete, so the next request opens after this one has gone.
 */
export function DialogHost({ request, onClosed }: { request: DialogRequest | undefined; onClosed: () => void }) {
  if (!request) return null
  return <HostedDialog key={request.id} request={request} onClosed={onClosed} />
}

function HostedDialog({ request, onClosed }: { request: DialogRequest; onClosed: () => void }) {
  const messages = useMessages()
  const [open, setOpen] = useState(true)
  const confirmRef = useRef<HTMLElement | null>(null)
  const cancelRef = useRef<HTMLElement | null>(null)
  const okRef = useRef<HTMLElement | null>(null)

  const answer = (ok: boolean) => {
    if (request.type === 'confirm') request.resolve(ok)
    else request.resolve()
    setOpen(false)
  }

  const { options } = request
  const danger = request.type === 'confirm' && request.options.tone === 'danger'
  const initialFocus = request.type === 'alert' ? okRef : danger ? cancelRef : confirmRef

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) answer(false)
      }}
      onOpenChangeComplete={(next) => {
        if (!next) onClosed()
      }}
    >
      <AlertDialog.Portal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup size="fit" layout="dialog" initialFocus={initialFocus}>
            <DialogHeader>
              <DialogHeadings>
                <DialogTitle>{options.title}</DialogTitle>
                {options.description !== undefined && <DialogDescription>{options.description}</DialogDescription>}
              </DialogHeadings>
            </DialogHeader>
            <DialogFooter>
              {request.type === 'confirm' ? (
                <>
                  <Button ref={cancelRef} variant="outline" onClick={() => answer(false)}>
                    {request.options.cancelLabel ?? messages.cancel}
                  </Button>
                  <Button ref={confirmRef} tone={danger ? 'danger' : 'action'} onClick={() => answer(true)}>
                    {request.options.confirmLabel ?? messages.confirm}
                  </Button>
                </>
              ) : (
                <Button ref={okRef} onClick={() => answer(true)}>
                  {request.options.okLabel ?? messages.ok}
                </Button>
              )}
            </DialogFooter>
          </DialogPopup>
        </DialogViewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
