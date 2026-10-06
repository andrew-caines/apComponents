// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Tabs, type TabsItem } from './Tabs.js'

afterEach(cleanup)

/** As in Popover.test.tsx: generated ids differ between renders, nothing else may. */
function normaliseIds(html: string): string {
  return html
    .replace(/\bid="[^"]*"/g, 'id="ID"')
    .replace(/\baria-(labelledby|describedby|controls|owns)="[^"]*"/g, 'aria-$1="ID"')
}

const items: TabsItem[] = [
  { value: 'a', label: 'Alpha', content: 'Alpha content' },
  { value: 'b', label: 'Beta', content: 'Beta content' },
  { value: 'c', label: 'Gamma', content: 'Gamma content' },
]

describe('Tabs (convenience)', () => {
  // Each `@ts-expect-error` is enforced by `npm run typecheck`: if the line
  // stops erroring the directive becomes an unused suppression and fails.
  it('requires exactly one name at compile time', () => {
    const elements = [
      // @ts-expect-error neither aria-label nor aria-labelledby
      <Tabs items={items} />,
      // @ts-expect-error both aria-label and aria-labelledby
      <Tabs items={items} aria-label="A" aria-labelledby="b" />,
      <Tabs items={items} aria-label="A" />,
      <Tabs items={items} aria-labelledby="b" />,
    ]
    expect(elements).toHaveLength(4)
  })

  // Fails if `aria-label` is dropped instead of routed to the list.
  it('names the tablist by aria-label', () => {
    render(<Tabs aria-label="Account" items={items} />)
    expect(screen.getByRole('tablist', { name: 'Account' })).toBeTruthy()
  })

  // Fails if `aria-labelledby` is dropped instead of routed to the list.
  it('names the tablist by aria-labelledby', () => {
    render(
      <>
        <h2 id="h">Billing</h2>
        <Tabs aria-labelledby="h" items={items} />
      </>,
    )
    expect(screen.getByRole('tablist', { name: 'Billing' })).toBeTruthy()
  })

  // Review Focus 1. Fails if the default is items[0] (disabled): `b` is then
  // not the selected tab.
  it('defaults to the first enabled item', () => {
    render(
      <Tabs aria-label="x" items={[{ ...items[0]!, disabled: true }, items[1]!, items[2]!]} />,
    )
    expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toBe('Beta content')
  })

  // Fails if an explicit defaultValue is overridden by the first-enabled rule.
  it('honours an explicit defaultValue', () => {
    render(<Tabs aria-label="x" items={items} defaultValue="c" />)
    expect(screen.getByRole('tabpanel').textContent).toBe('Gamma content')
  })

  // Fails if a disabled item is chosen when no item is enabled.
  it('selects nothing when every item is disabled', () => {
    render(<Tabs aria-label="x" items={items.map((i) => ({ ...i, disabled: true }))} />)
    expect(screen.queryByRole('tabpanel')).toBeNull()
  })

  // Fails if `keepMounted` is not passed to the panels: inactive ones unmount.
  it('keeps inactive panels in the DOM with keepMounted', () => {
    render(<Tabs aria-label="x" items={items} keepMounted />)
    expect(screen.getByText('Beta content')).toBeTruthy()
    expect(screen.getByText('Gamma content')).toBeTruthy()
  })

  // The counterpart. Fails if keepMounted defaults to true.
  it('unmounts inactive panels by default', () => {
    render(<Tabs aria-label="x" items={items} />)
    expect(screen.queryByText('Beta content')).toBeNull()
  })

  // Fails if `variant`/`orientation` stop reaching the root, or the indicator
  // is not the first child of the list.
  it('renders the same DOM as the hand assembly', () => {
    render(<Tabs aria-label="Sections" items={items} variant="pills" orientation="vertical" />)
    const a = normaliseIds(document.body.innerHTML)
    cleanup()
    render(
      <Tabs.Root defaultValue="a" variant="pills" orientation="vertical">
        <Tabs.List aria-label="Sections">
          <Tabs.Indicator />
          <Tabs.Tab value="a">Alpha</Tabs.Tab>
          <Tabs.Tab value="b">Beta</Tabs.Tab>
          <Tabs.Tab value="c">Gamma</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a">Alpha content</Tabs.Panel>
        <Tabs.Panel value="b">Beta content</Tabs.Panel>
        <Tabs.Panel value="c">Gamma content</Tabs.Panel>
      </Tabs.Root>,
    )
    const b = normaliseIds(document.body.innerHTML)
    expect(a).toBe(b)
    expect(a).toContain('aria-orientation="vertical"')
  })

  // Fails if `onValueChange` is not forwarded to the root.
  it('calls onValueChange with the clicked tab value and details', () => {
    const onValueChange = vi.fn()
    render(<Tabs aria-label="x" items={items} onValueChange={onValueChange} />)
    onValueChange.mockClear()
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]![0]).toBe('b')
    expect(typeof onValueChange.mock.calls[0]![1]).toBe('object')
  })

  // Fails if null is filtered out: Base UI's fallback notifies null when the
  // selected tab is disabled and no enabled tab remains
  // (`tabs/root/TabsRoot.js:220`, `:194`). Also fails if the first-enabled
  // default is recomputed every render: it changes from 'a' to nothing here,
  // and `useControlled` logs "changing the default value state of an
  // uncontrolled Tabs" (`@base-ui/utils/useControlled.js:35-36`).
  //
  // Base UI logs each distinct message once per module instance
  // (`@base-ui/utils/error.js`), and vitest gives each file its own, so only
  // the first test in this file to provoke the message sees it. This one runs
  // before the next, so with the perturbation this one fails; the next fails
  // when run alone (`-t`).
  it('notifies null when every item becomes disabled, without logging', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const onValueChange = vi.fn()
      const { rerender } = render(
        <Tabs aria-label="x" items={items} onValueChange={onValueChange} />,
      )
      onValueChange.mockClear()
      rerender(
        <Tabs
          aria-label="x"
          items={items.map((i) => ({ ...i, disabled: true }))}
          onValueChange={onValueChange}
        />,
      )
      expect(onValueChange.mock.calls.map((c) => c[0])).toContain(null)
      expect(errors.mock.calls).toEqual([])
    } finally {
      errors.mockRestore()
    }
  })

  // Fails if the first-enabled default is recomputed every render: items
  // that load after mount (empty, then filled) change it from nothing to
  // 'a', and the first item turning disabled changes it from 'a' to 'b'.
  // Either makes `useControlled` log (see the test above). The selection
  // still lands on an enabled tab through Base UI's client-side fallback.
  it('logs nothing when the items change after mount', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { rerender } = render(<Tabs aria-label="x" items={[]} />)
      rerender(<Tabs aria-label="x" items={items} />)
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: 'Alpha' }).getAttribute('aria-selected')).toBe(
          'true',
        ),
      )
      rerender(<Tabs aria-label="x" items={[{ ...items[0]!, disabled: true }, items[1]!]} />)
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('aria-selected')).toBe(
          'true',
        ),
      )
      expect(errors.mock.calls).toEqual([])
    } finally {
      errors.mockRestore()
    }
  })

  // Fails if `value` is not forwarded (the spread deleted): the root is then
  // uncontrolled and the click moves the selection. Also fails if the
  // callback is not forwarded or fires more than once.
  it('holds a controlled value until the parent changes it', async () => {
    const onValueChange = vi.fn()
    const { rerender } = render(
      <Tabs aria-label="x" items={items} value="a" onValueChange={onValueChange} />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }))
    expect(screen.getByRole('tab', { name: 'Alpha' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toBe('Alpha content')
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]![0]).toBe('b')
    rerender(<Tabs aria-label="x" items={items} value="b" onValueChange={onValueChange} />)
    await waitFor(() => expect(screen.getByRole('tabpanel').textContent).toBe('Beta content'))
    expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('aria-selected')).toBe('true')
  })

  // Fails if `disabled` is not passed to the tab.
  it('marks a disabled item as a disabled tab', () => {
    render(<Tabs aria-label="x" items={[{ ...items[0]!, disabled: true }, items[1]!]} />)
    expect(screen.getByRole('tab', { name: 'Alpha' }).hasAttribute('data-disabled')).toBe(true)
    expect(screen.getByRole('tab', { name: 'Beta' }).hasAttribute('data-disabled')).toBe(false)
  })
})
