// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Accordion, type AccordionSection } from './Accordion.js'

afterEach(cleanup)

/** As in Tabs.test.tsx: generated ids differ between renders, nothing else may. */
function normaliseIds(html: string): string {
  return html
    .replace(/\bid="[^"]*"/g, 'id="ID"')
    .replace(/\baria-(labelledby|describedby|controls|owns)="[^"]*"/g, 'aria-$1="ID"')
}

const items: AccordionSection[] = [
  { value: 'a', title: 'Alpha', content: 'Alpha content' },
  { value: 'b', title: 'Beta', content: 'Beta content' },
  { value: 'c', title: 'Gamma', content: 'Gamma content', disabled: true },
]

describe('Accordion (convenience)', () => {
  // Each `@ts-expect-error` is enforced by `npm run typecheck`.
  it('rejects heading levels outside 2-6 and unknown values at compile time', () => {
    const narrow: AccordionSection<'a' | 'b'>[] = [{ value: 'a', title: 't', content: 'c' }]
    const elements = [
      // @ts-expect-error level 1 is the page title, not a section heading
      <Accordion items={items} headingLevel={1} />,
      // @ts-expect-error level 7 does not exist
      <Accordion items={items} headingLevel={7} />,
      // @ts-expect-error defaultValue must hold values of the declared Value type
      <Accordion<'a' | 'b'> items={narrow} defaultValue={['z']} />,
      <Accordion items={items} headingLevel={2} />,
    ]
    expect(elements).toHaveLength(4)
  })

  // Fails if `headingLevel` is ignored (headers stay h3).
  it('renders h2 headers for headingLevel 2', () => {
    render(<Accordion items={items} headingLevel={2} />)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3)
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
  })

  // Fails if the default is not 3.
  it('renders h3 headers by default', () => {
    render(<Accordion items={items} />)
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)
  })

  // Fails if `hiddenUntilFound` is not passed: closed panels then unmount.
  it('keeps a closed panel in the DOM, carrying hidden', () => {
    render(<Accordion items={items} />)
    const panel = screen.getByText('Beta content').closest('[role="region"]')!
    expect(panel).toBeTruthy()
    expect(panel.hasAttribute('hidden')).toBe(true)
  })

  // Fails if `hiddenUntilFound` is dropped: the value would be absent.
  // jsdom keeps the exact value, so it is asserted here.
  it('sets hidden="until-found" on a closed panel after mount', async () => {
    render(<Accordion items={items} />)
    const panel = screen.getByText('Beta content').closest('[role="region"]')!
    await waitFor(() => expect(panel.getAttribute('hidden')).toBe('until-found'))
  })

  // Fails if opening does not reach Base UI, or the callback is not forwarded.
  it('opens a section on click and notifies with the value array', async () => {
    const onValueChange = vi.fn()
    render(<Accordion items={items} onValueChange={onValueChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-expanded')).toBe(
        'true',
      ),
    )
    expect(onValueChange.mock.calls[0]![0]).toEqual(['a'])
  })

  // Fails if `defaultValue` is not forwarded.
  it('honours defaultValue', () => {
    render(<Accordion items={items} defaultValue={['b']} />)
    expect(screen.getByRole('button', { name: 'Beta' }).getAttribute('aria-expanded')).toBe('true')
  })

  // Fails if `disabled` is not forwarded to the item.
  it('disables an item', () => {
    render(<Accordion items={items} />)
    expect(screen.getByRole('button', { name: 'Gamma' }).hasAttribute('data-disabled')).toBe(true)
  })

  // Fails if the convenience component adds or drops anything the parts do not.
  it('renders the same DOM as the hand assembly', () => {
    render(<Accordion items={items} headingLevel={2} defaultValue={['a']} />)
    const a = normaliseIds(document.body.innerHTML)
    cleanup()
    render(
      <Accordion.Root defaultValue={['a']} hiddenUntilFound>
        <Accordion.Item value="a">
          <Accordion.Header render={<h2 />}>
            <Accordion.Trigger>Alpha</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Alpha content</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Header render={<h2 />}>
            <Accordion.Trigger>Beta</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Beta content</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="c" disabled>
          <Accordion.Header render={<h2 />}>
            <Accordion.Trigger>Gamma</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Gamma content</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    )
    const b = normaliseIds(document.body.innerHTML)
    expect(a).toBe(b)
    expect(a).toContain('<h2')
  })
})
