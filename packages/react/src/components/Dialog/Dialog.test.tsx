// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog.js'
import { popupRecipe } from './Dialog.css.js'
import { Button } from '../Button/Button.js'
import { LocaleProvider } from '../../providers/LocaleProvider.js'

/**
 * Dialog is the first component that genuinely requires the provider stack: its
 * dismiss control reads its accessible name from the message registry, so there
 * is nothing sensible to render without one. ADR-0012 accepts that cost
 * explicitly and requires the failure to be a clear error — which the last test
 * in this file is what actually holds to.
 */
const renderDialog = (ui: ReactElement) => render(<LocaleProvider>{ui}</LocaleProvider>)

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Open' }))

describe('Dialog', () => {
  it('renders the trigger and nothing else until it is opened', () => {
    renderDialog(
      <Dialog title="Delete employee" trigger={<Button>Open</Button>}>
        body
      </Dialog>,
    )
    expect(screen.getByRole('button', { name: 'Open' })).toBeDefined()
    expect(screen.queryByRole('dialog')).toBeNull()
    // Not merely unrendered as a role — the title text is nowhere in the
    // document either, which is the portal genuinely being absent rather than
    // present and hidden.
    expect(screen.queryByText('Delete employee')).toBeNull()
  })

  it('opens on the trigger and names itself from `title`', () => {
    renderDialog(
      <Dialog title="Delete employee" trigger={<Button>Open</Button>}>
        body
      </Dialog>,
    )
    open()
    // getByRole with a name runs the accessible-name computation, so this
    // asserts the aria-labelledby wiring rather than merely that the text is
    // somewhere on screen.
    expect(screen.getByRole('dialog', { name: 'Delete employee' })).toBeDefined()
  })

  it('wires `description` as the accessible description, not just as text', () => {
    renderDialog(
      <Dialog
        title="Delete employee"
        description="This cannot be undone."
        trigger={<Button>Open</Button>}
      >
        body
      </Dialog>,
    )
    const dialog = (open(), screen.getByRole('dialog'))
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    // Resolve the id rather than trusting the attribute exists: an
    // aria-describedby pointing at nothing is the failure this catches, and it
    // is indistinguishable from correct wiring if you only assert presence.
    expect(document.getElementById(describedBy!)?.textContent).toBe('This cannot be undone.')
  })

  describe('the dismiss control', () => {
    it('takes its accessible name from the message registry', () => {
      renderDialog(
        <Dialog title="Delete employee" trigger={<Button>Open</Button>}>
          body
        </Dialog>,
      )
      open()
      expect(screen.getByRole('button', { name: 'Close' })).toBeDefined()
    })

    it('follows the registry into another locale rather than shipping English ARIA', () => {
      render(
        <LocaleProvider locale="fr-FR" messages={{ close: 'Fermer' }}>
          <Dialog title="Supprimer" trigger={<Button>Open</Button>}>
            body
          </Dialog>
        </LocaleProvider>,
      )
      open()
      expect(screen.getByRole('button', { name: 'Fermer' })).toBeDefined()
      expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    })

    it('closes the dialog', () => {
      renderDialog(
        <Dialog title="Delete employee" trigger={<Button>Open</Button>}>
          body
        </Dialog>,
      )
      open()
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('is absent under `dismissible={false}`', () => {
      renderDialog(
        <Dialog title="Delete employee" dismissible={false} trigger={<Button>Open</Button>}>
          body
        </Dialog>,
      )
      open()
      expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
      // The surface is still there — `dismissible` removes the chrome, not the
      // dialog, and Escape still closes it.
      expect(screen.getByRole('dialog')).toBeDefined()
    })
  })

  describe('size', () => {
    it('defaults to md', () => {
      renderDialog(
        <Dialog title="T" trigger={<Button>Open</Button>}>
          body
        </Dialog>,
      )
      open()
      const expected = popupRecipe({ size: 'md', layout: 'auto' }).split(' ')
      for (const cls of expected) {
        expect(screen.getByRole('dialog').className).toContain(cls)
      }
    })

    it('gives every size its own class, so no two collapse onto one width', () => {
      const sizes = ['sm', 'md', 'lg', 'xl', 'fit'] as const
      const classes = sizes.map((size) => popupRecipe({ size, layout: 'auto' }))
      expect(new Set(classes).size).toBe(sizes.length)
    })

    it('gives `fit` a different class from every fixed size', () => {
      // `fit` is the one size whose rule sets three properties rather than one
      // (inline-size, a floor and a cap). If it collapsed onto a fixed size's
      // class the floor would be gone, and a fit dialog wrapping a form would
      // shrink to its longest label — the failure the floor exists to prevent.
      // The computed-width half of this claim is asserted in a real browser by
      // `gen:dialog-demo`.
      const fit = popupRecipe({ size: 'fit', layout: 'auto' })
      for (const size of ['sm', 'md', 'lg', 'xl'] as const) {
        expect(fit).not.toBe(popupRecipe({ size, layout: 'auto' }))
      }
    })
  })

  it('gives `layout="dialog"` a different class from the adaptive default', () => {
    expect(popupRecipe({ size: 'md', layout: 'auto' })).not.toBe(
      popupRecipe({ size: 'md', layout: 'dialog' }),
    )
  })

  it('renders a footer only when given one', () => {
    const { unmount } = renderDialog(
      <Dialog title="T" trigger={<Button>Open</Button>}>
        body
      </Dialog>,
    )
    open()
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull()
    unmount()

    renderDialog(
      <Dialog title="T" trigger={<Button>Open</Button>} footer={<Button>Confirm</Button>}>
        body
      </Dialog>,
    )
    open()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined()
  })

  it('renders the trigger through `render`, not wrapped — no button inside a button', () => {
    renderDialog(
      <Dialog title="T" trigger={<Button>Open</Button>}>
        body
      </Dialog>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    expect(trigger.querySelector('button')).toBeNull()
  })

  it('attaches every compound part it documents', () => {
    // Cheap, and it catches a defect the rest of this file structurally cannot.
    // A part left off the namespace is `undefined`, and `<Dialog.Close />` then
    // throws React error #130 — but only when that element actually renders,
    // which for anything inside the popup means only in a browser, only after
    // the dialog is opened. `Dialog.Close` shipped missing exactly this way and
    // was caught by the fixture, three layers further out than it should have
    // been.
    const parts = [
      'Root', 'Trigger', 'Portal', 'Backdrop', 'Viewport', 'Popup',
      'Title', 'Description', 'Header', 'Headings', 'Body', 'Footer',
      'Close', 'Dismiss',
    ] as const
    for (const part of parts) {
      expect(Dialog[part], `Dialog.${part} is not attached`).toBeDefined()
    }
  })

  it('fails with a clear error outside the provider stack (ADR-0012)', () => {
    // ADR-0012 accepts "the provider stack is required" as a cost, on the
    // condition that a component used outside it "fail with a clear error
    // rather than a confusing one". Dialog is the first component to exercise
    // that clause, so this is the first test that holds it to it — without it,
    // the guarantee is only a sentence in a document.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() =>
        render(
          <Dialog title="T" defaultOpen>
            body
          </Dialog>,
        ),
      ).toThrow(/must be used inside <LocaleProvider>/)
    } finally {
      errors.mockRestore()
    }
  })
})
