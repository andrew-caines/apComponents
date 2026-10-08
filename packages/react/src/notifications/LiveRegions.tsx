'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { visuallyHiddenClass } from '../internal/visuallyHidden.css.js'

type Politeness = 'polite' | 'assertive'

const CLEAR_AFTER_MS = 5000

export interface Announcer {
  polite: string
  assertive: string
  announce: (message: string, politeness: Politeness) => void
}

interface Pending {
  frame: number | undefined
  timer: ReturnType<typeof setTimeout> | undefined
}

/**
 * The text of the two live regions, as React state. An announcement empties the
 * region, then sets the message in the next frame, so announcing the same text
 * twice still changes the DOM and is read again. A timer empties the region
 * after 5 s. Pending frames and timers are cancelled on unmount.
 */
export function useAnnouncer(): Announcer {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  const pending = useRef<Record<Politeness, Pending>>({
    polite: { frame: undefined, timer: undefined },
    assertive: { frame: undefined, timer: undefined },
  })

  const cancel = useCallback((politeness: Politeness) => {
    const slot = pending.current[politeness]
    if (slot.frame !== undefined) cancelAnimationFrame(slot.frame)
    if (slot.timer !== undefined) clearTimeout(slot.timer)
    slot.frame = undefined
    slot.timer = undefined
  }, [])

  const announce = useCallback(
    (message: string, politeness: Politeness) => {
      const set = politeness === 'polite' ? setPolite : setAssertive
      cancel(politeness)
      set('')
      const slot = pending.current[politeness]
      slot.frame = requestAnimationFrame(() => {
        slot.frame = undefined
        set(message)
        slot.timer = setTimeout(() => {
          slot.timer = undefined
          set('')
        }, CLEAR_AFTER_MS)
      })
    },
    [cancel],
  )

  useEffect(
    () => () => {
      cancel('polite')
      cancel('assertive')
    },
    [cancel],
  )

  return { polite, assertive, announce }
}

/** Two visually hidden live regions, rendered empty on the server. */
export function LiveRegions({ polite, assertive }: { polite: string; assertive: string }) {
  return (
    <>
      <div className={visuallyHiddenClass} aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className={visuallyHiddenClass} aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </>
  )
}
