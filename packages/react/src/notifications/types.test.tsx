// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApProvider } from '../providers/ApProvider.js'
import { alert, announce, banner, confirm, toast } from './api.js'
import { NotificationProvider } from './NotificationProvider.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('option types accept explicit undefined', () => {
  // Type test. The assertion is that `npm run typecheck` compiles this file:
  // under exactOptionalPropertyTypes an optional declared `?: T` rejects an
  // explicit `undefined` (TS2379/TS2375), so narrowing any of these options
  // back to `?: T` fails typecheck on the matching line. The runtime part only
  // checks the calls return. Same mechanism as Select.test.tsx.
  it('compiles every public optional set to undefined', async () => {
    // No provider is mounted, so each call is dropped with a development warning.
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const id = toast({
      title: 'x',
      description: undefined,
      severity: undefined,
      action: undefined,
      id: undefined,
      timeout: undefined,
    })
    expect(typeof id).toBe('string')

    const shown = banner({
      title: 'x',
      description: undefined,
      severity: undefined,
      action: undefined,
      id: undefined,
      dismissible: undefined,
    })
    expect(typeof shown.id).toBe('string')

    expect(
      await confirm({
        title: 'x',
        description: undefined,
        confirmLabel: undefined,
        cancelLabel: undefined,
        tone: undefined,
      }),
    ).toBe(false)

    expect(await alert({ title: 'x', description: undefined, okLabel: undefined })).toBeUndefined()

    expect(announce('x', { politeness: undefined })).toBeUndefined()

    const provider = <NotificationProvider placement={undefined}>{null}</NotificationProvider>
    const app = <ApProvider notifications={{ placement: undefined }}>{null}</ApProvider>
    expect(provider.type).toBe(NotificationProvider)
    expect(app.type).toBe(ApProvider)
  })
})
