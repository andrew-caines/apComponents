// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Toast as BaseToast } from '@base-ui/react/toast'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ICON_PATHS } from '../../icons/paths.js'
import { DEFAULT_MESSAGES } from '../../providers/messages.js'
import { LocaleProvider } from '../../providers/LocaleProvider.js'
import { Button } from '../Button/Button.js'
import { toastViewportRecipe } from './Toast.css.js'
import {
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastRoot,
  ToastTitle,
  ToastViewport,
  type ToastPlacement,
} from './ToastParts.js'
import { ToastList } from './ToastList.js'

// Base UI waits for getAnimations() to finish before it removes an ended toast
// (internals/useAnimationsFinished.js:40). jsdom has no animations, so without
// this flag the removal path differs from the browser's. The flag makes removal
// immediate and keeps these tests about our wiring.
beforeAll(() => {
  ;(globalThis as { BASE_UI_ANIMATIONS_DISABLED?: boolean }).BASE_UI_ANIMATIONS_DISABLED = true
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

type AddOptions = Parameters<ReturnType<typeof BaseToast.useToastManager>['add']>[0]

function Adder({ options }: { options: AddOptions }) {
  const manager = BaseToast.useToastManager()
  return (
    <button type="button" onClick={() => manager.add(options)}>
      add
    </button>
  )
}

/** A list of our own parts with `render={<Button />}`, to pin the nativeButton derivation. */
function RenderedList({ link = false }: { link?: boolean }) {
  const { toasts } = BaseToast.useToastManager()
  return (
    <>
      {toasts.map((toast) => (
        <ToastRoot key={toast.id} toast={toast} className="c-root">
          <ToastTitle className="c-title" />
          <ToastDescription className="c-desc" />
          <ToastAction className="c-action" render={link ? <a href="#a" /> : <Button />} />
          <ToastClose className="c-close" render={link ? <a href="#c" /> : <Button />} />
        </ToastRoot>
      ))}
    </>
  )
}

function harness(
  options: AddOptions,
  placement: ToastPlacement = 'bottom-end',
  messages?: { notifications: string },
  list: 'default' | 'rendered' | 'links' = 'default',
) {
  return (
    <LocaleProvider {...(messages ? { messages } : {})}>
      <BaseToast.Provider>
        <Adder options={options} />
        <BaseToast.Portal>
          <ToastViewport placement={placement}>
            {list === 'default' ? (
              <ToastList placement={placement} />
            ) : (
              <RenderedList link={list === 'links'} />
            )}
          </ToastViewport>
        </BaseToast.Portal>
      </BaseToast.Provider>
    </LocaleProvider>
  )
}

async function add(
  options: AddOptions,
  placement?: ToastPlacement,
  list: 'default' | 'rendered' | 'links' = 'default',
) {
  render(harness(options, placement, undefined, list))
  fireEvent.click(screen.getByText('add'))
  return screen.findByRole(options.priority === 'high' ? 'alertdialog' : 'dialog', {
    hidden: true,
  })
}

function pathOf(el: Element): string | null | undefined {
  return el.querySelector('svg path')?.getAttribute('d')
}

describe('ToastViewport', () => {
  it('is a region named by the notifications message', async () => {
    render(harness({ title: 'x' }))
    fireEvent.click(screen.getByText('add'))
    const region = await screen.findByRole('region', { name: DEFAULT_MESSAGES.notifications })
    expect(region).not.toBeNull()
  })

  it('takes its label from the locale messages (fails if the label is hardcoded)', async () => {
    render(harness({ title: 'x' }, 'bottom-end', { notifications: 'Avisos' }))
    fireEvent.click(screen.getByText('add'))
    const region = await screen.findByRole('region', { name: 'Avisos' })
    expect(region).not.toBeNull()
  })

  it('lets a caller override the label (fails if rest is spread before aria-label)', async () => {
    render(
      <LocaleProvider>
        <BaseToast.Provider>
          <BaseToast.Portal>
            <ToastViewport aria-label="Mine" />
          </BaseToast.Portal>
        </BaseToast.Provider>
      </LocaleProvider>,
    )
    const region = await screen.findByRole('region')
    expect(region.getAttribute('aria-label')).toBe('Mine')
  })

  it('applies the placement recipe (fails if the prop is ignored)', async () => {
    render(harness({ title: 'x' }, 'top-start'))
    const region = await screen.findByRole('region')
    const top = toastViewportRecipe({ placement: 'top-start' })
    const bottom = toastViewportRecipe({ placement: 'bottom-end' })
    expect(top).not.toBe(bottom)
    expect(region.className).toContain(top)
    expect(region.className).not.toContain(bottom)
  })

  it('defaults to bottom-end', async () => {
    render(
      <LocaleProvider>
        <BaseToast.Provider>
          <BaseToast.Portal>
            <ToastViewport />
          </BaseToast.Portal>
        </BaseToast.Provider>
      </LocaleProvider>,
    )
    const region = await screen.findByRole('region')
    expect(region.className).toContain(toastViewportRecipe({ placement: 'bottom-end' }))
  })

  it('merges className', async () => {
    render(
      <LocaleProvider>
        <BaseToast.Provider>
          <BaseToast.Portal>
            <ToastViewport className="mine" />
          </BaseToast.Portal>
        </BaseToast.Provider>
      </LocaleProvider>,
    )
    const region = await screen.findByRole('region')
    expect(region.className).toContain('mine')
    expect(region.className).toContain(toastViewportRecipe({ placement: 'bottom-end' }))
  })
})

describe('ToastList', () => {
  it('renders an error toast as an alertdialog with the alert-circle icon (fails if two icon mappings swap)', async () => {
    const root = await add({ title: 'Boom', type: 'error', priority: 'high', timeout: 0 })
    expect(root.getAttribute('data-type')).toBe('error')
    expect(pathOf(root)).toBe(ICON_PATHS['alert-circle'])
  })

  it('renders an info toast as a dialog with the info icon', async () => {
    const root = await add({ title: 'Hi', type: 'info' })
    expect(root.getAttribute('data-type')).toBe('info')
    expect(pathOf(root)).toBe(ICON_PATHS.info)
  })

  it('maps success and warning to their own icons', async () => {
    const ok = await add({ title: 'ok', type: 'success' })
    expect(pathOf(ok)).toBe(ICON_PATHS['check-circle'])
    cleanup()
    const warn = await add({ title: 'hm', type: 'warning' })
    expect(pathOf(warn)).toBe(ICON_PATHS['alert-triangle'])
  })

  it('renders the spinner, not a severity icon, for a loading toast', async () => {
    const root = await add({ title: 'Working', type: 'loading' })
    const svg = root.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    // The first svg is the leading glyph. A severity icon would carry one of
    // these paths; the spinner draws no `path` from the icon set at all.
    const severity = ['info', 'check-circle', 'alert-triangle', 'alert-circle'] as const
    for (const name of severity) {
      expect(svg?.querySelector(`path[d="${ICON_PATHS[name]}"]`), name).toBeNull()
    }
  })

  it('names the close button from the dismiss message and removes the toast on click', async () => {
    await add({ title: 'Bye' })
    // Base UI hides the close button from the accessibility tree until the
    // stack is expanded (toast/close/ToastClose.js:49), so find it by label.
    fireEvent.click(screen.getByLabelText(DEFAULT_MESSAGES.dismiss))
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull())
  })

  it('renders the action label and calls onClick', async () => {
    const onClick = vi.fn()
    await add({ title: 'Undo?', actionProps: { children: 'Undo', onClick } })
    fireEvent.click(screen.getByRole('button', { name: 'Undo', hidden: true }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('hands the placement to the root as data-placement', async () => {
    const root = await add({ title: 'x' }, 'top-center')
    expect(root.getAttribute('data-placement')).toBe('top-center')
  })
})

describe('parts given render={<Button />}', () => {
  it('are native buttons: type="button", no role (fails if the nativeButton derivation is dropped)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await add(
      { title: 'x', actionProps: { children: 'Act' } },
      'bottom-end',
      'rendered',
    )
    // Both are aria-hidden until the stack is expanded (ToastClose.js:49), so
    // role queries cannot reach them.
    const buttons = [screen.getByText('Act'), screen.getByLabelText(DEFAULT_MESSAGES.dismiss)]
    for (const button of buttons) {
      expect(button.getAttribute('type')).toBe('button')
      expect(button.getAttribute('role')).toBeNull()
    }
    expect(error).not.toHaveBeenCalled()
  })

  it('are non-native when the render is an anchor: role="button", no type, no console.error (fails if the nativeButton derivation is dropped)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await add({ title: 'x', actionProps: { children: 'Act' } }, 'bottom-end', 'links')
    const buttons = [screen.getByText('Act'), screen.getByLabelText(DEFAULT_MESSAGES.dismiss)]
    for (const button of buttons) {
      expect(button.tagName).toBe('A')
      expect(button.getAttribute('role')).toBe('button')
    }
    expect(error).not.toHaveBeenCalled()
  })

  it('merge className on every styled part, keeping the recipe class (fails if className replaces it)', async () => {
    await add(
      { title: 'T', description: 'D', actionProps: { children: 'A' } },
      'bottom-end',
      'rendered',
    )
    for (const c of ['c-root', 'c-title', 'c-desc', 'c-action', 'c-close']) {
      const el = document.querySelector(`.${c}`)
      expect(el, c).not.toBeNull()
      expect(el!.className.split(' ').length, `${c} keeps its recipe class`).toBeGreaterThan(1)
    }
  })
})
