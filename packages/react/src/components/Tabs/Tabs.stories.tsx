import { useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '../Button/Button.js'
import { Tabs, type TabsItem } from './Tabs.js'

const ITEMS: ReadonlyArray<TabsItem> = [
  { value: 'overview', label: 'Overview', content: 'Overview panel' },
  { value: 'activity', label: 'Activity', content: 'Activity panel' },
  { value: 'settings', label: 'Account settings', content: 'Settings panel' },
  { value: 'billing', label: 'Billing', content: 'Billing panel' },
]

const MANY: ReadonlyArray<TabsItem> = Array.from({ length: 12 }, (_, i) => ({
  value: `tab-${i + 1}`,
  label: `Quarterly section ${i + 1}`,
  content: `Section ${i + 1} panel`,
}))

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  argTypes: {
    variant: { control: 'inline-radio', options: ['underline', 'pills'] },
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
  },
  args: {
    'aria-label': 'Project',
    items: ITEMS,
  },
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

/** Base UI's indicator is the list's `<span role="presentation">`, its first child. */
const indicatorOf = (list: HTMLElement): HTMLElement => {
  const el = list.querySelector<HTMLElement>(':scope > [role="presentation"]')
  if (el === null) throw new Error('no indicator inside the tab list')
  return el
}

const centreX = (r: DOMRect) => r.left + r.width / 2
const centreY = (r: DOMRect) => r.top + r.height / 2

/** Horizontal alignment: centres within 2 px, inline sizes within 2 px. */
const expectInlineAligned = (indicator: HTMLElement, tab: HTMLElement) => {
  const i = indicator.getBoundingClientRect()
  const t = tab.getBoundingClientRect()
  expect(indicator.hidden).toBe(false)
  expect(i.width).toBeGreaterThan(0)
  expect(Math.abs(centreX(i) - centreX(t))).toBeLessThanOrEqual(2)
  expect(Math.abs(i.width - t.width)).toBeLessThanOrEqual(2)
}

/**
 * Manual activation with a real keyboard. Tab from the button before the
 * list lands on the selected tab (Activity), not the first one. ArrowRight
 * moves focus to the next tab without selecting it, and Enter selects it and
 * swaps the panel. The jsdom unit test could not prove Enter (jsdom does not
 * turn Enter on a button into a click); this does. Perturbations: passing
 * `activateOnFocus` to `TabsList` selects on ArrowRight and fails the
 * still-selected check; dropping the `{Enter}` press fails the selection
 * check.
 */
export const Default: Story = {
  args: { defaultValue: 'activity' },
  render: (args) => (
    <div style={{ padding: '2rem' }}>
      <Button variant="ghost">Before</Button>
      <Tabs {...args} />
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const activity = canvas.getByRole('tab', { name: 'Activity' })
    const settings = canvas.getByRole('tab', { name: 'Account settings' })

    await step('Tab lands on the selected tab', async () => {
      canvas.getByRole('button', { name: 'Before' }).focus()
      await userEvent.tab()
      await waitFor(() => expect(activity).toHaveFocus())
      await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Activity panel')
    })

    await step('ArrowRight moves focus, not selection', async () => {
      await userEvent.keyboard('{ArrowRight}')
      await waitFor(() => expect(settings).toHaveFocus())
      // Give a focus-driven selection time to land before checking it did not.
      await new Promise((resolve) => setTimeout(resolve, 200))
      await expect(activity).toHaveAttribute('aria-selected', 'true')
      await expect(settings).toHaveAttribute('aria-selected', 'false')
      await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Activity panel')
    })

    await step('Enter selects and swaps the panel', async () => {
      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(settings).toHaveAttribute('aria-selected', 'true'))
      await expect(activity).toHaveAttribute('aria-selected', 'false')
      await waitFor(() =>
        expect(canvas.getByRole('tabpanel')).toHaveTextContent('Settings panel'),
      )
    })
  },
}

/** Mounts and unmounts its children on click, so a play can watch a mount itself. */
function MountToggle({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false)
  return (
    <>
      <Button variant="ghost" onClick={() => setShown((s) => !s)}>
        Toggle tabs
      </Button>
      {shown ? children : null}
    </>
  )
}

/**
 * The underline under the selected tab. First paint (R3): the tabs mount on a
 * click (after a warm-up mount that loads their font), and the moment the indicator is first visible it already sits under
 * the initial tab (Activity) with no transition running, so it never slides
 * in from 0x0 (Base UI keeps it `hidden` until the tab measures,
 * `TabsIndicator.js:111,124`, and leaving `display: none` starts no
 * transition). Then after selecting tab 3 the transition lands with the
 * indicator's centre and inline size within 2 px of the tab's.
 * Perturbations: pointing the LTR indicator at `--active-tab-right` mirrors
 * it and fails the alignment check; turning the `[hidden]` guard into
 * `display: 'block'` at `insetInlineStart: 0`, `inlineSize: 0` gives the
 * transition a 0x0 start and fails the first-paint check.
 */
export const Indicator: Story = {
  args: { defaultValue: 'activity' },
  render: (args) => (
    <div style={{ padding: '2rem' }}>
      <MountToggle>
        <Tabs {...args} />
      </MountToggle>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: 'Toggle tabs' })
    // A warm-up mount: the tab text pulls in a font face nothing else on the
    // page has used, and the swap from the fallback widens the tab (by ~3 px,
    // observed), which the indicator then follows with a transition. Load it,
    // unmount, and watch a clean second mount.
    await userEvent.click(toggle)
    await canvas.findByRole('tablist')
    await document.fonts.ready
    await userEvent.click(toggle)
    await waitFor(() => expect(canvas.queryByRole('tablist')).toBeNull())
    await userEvent.click(toggle)
    const list = await canvas.findByRole('tablist')
    const indicator = indicatorOf(list)

    await step('first visible frame is at the initial tab, no slide-in', async () => {
      // waitFor's MutationObserver resolves on the commit that drops `hidden`.
      await waitFor(() => expect(indicator.hidden).toBe(false))
      // No waitFor from here: this is the state as it first appears.
      expectInlineAligned(indicator, canvas.getByRole('tab', { name: 'Activity' }))
      await expect(indicator.getAnimations()).toHaveLength(0)
    })

    await step('selecting tab 3 moves the indicator under it', async () => {
      const settings = canvas.getByRole('tab', { name: 'Account settings' })
      await userEvent.click(settings)
      await waitFor(() => expect(settings).toHaveAttribute('aria-selected', 'true'))
      await waitFor(() => expectInlineAligned(indicator, settings))
    })
  },
}

/**
 * The pill sits behind the selected tab and matches its whole box.
 * Perturbation: dropping the pill's `blockSize` collapses it and fails the
 * block-size check. (Dropping `insetBlockStart` is not caught: in a one-row
 * list the static position is already the tab's top. Paint order, tab above
 * pill, is not asserted: the pill has `pointerEvents: 'none'`, so hit testing
 * cannot see it.)
 */
export const Pills: Story = {
  args: { variant: 'pills' },
  render: (args) => (
    <div style={{ padding: '2rem' }}>
      <Tabs {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const indicator = indicatorOf(canvas.getByRole('tablist'))
    const settings = canvas.getByRole('tab', { name: 'Account settings' })
    await userEvent.click(settings)
    await waitFor(() => {
      expectInlineAligned(indicator, settings)
      const i = indicator.getBoundingClientRect()
      const t = settings.getBoundingClientRect()
      expect(Math.abs(i.top - t.top)).toBeLessThanOrEqual(2)
      expect(Math.abs(i.height - t.height)).toBeLessThanOrEqual(2)
    })
  },
}

/**
 * A vertical underline: the indicator spans the selected tab's block extent
 * and sits at the list's inline end. Perturbations: placing it at
 * `var(--active-tab-bottom)` instead of `--active-tab-top` fails the block
 * check; dropping `insetInlineEnd: 0` moves it to the inline start and fails
 * the inline-end check.
 */
export const Vertical: Story = {
  args: { orientation: 'vertical' },
  render: (args) => (
    <div style={{ padding: '2rem' }}>
      <Tabs {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole('tablist')
    const indicator = indicatorOf(list)
    await expect(list).toHaveAttribute('aria-orientation', 'vertical')
    const settings = canvas.getByRole('tab', { name: 'Account settings' })
    await userEvent.click(settings)
    await waitFor(() => {
      const i = indicator.getBoundingClientRect()
      const t = settings.getBoundingClientRect()
      const l = list.getBoundingClientRect()
      expect(i.height).toBeGreaterThan(0)
      expect(Math.abs(centreY(i) - centreY(t))).toBeLessThanOrEqual(2)
      expect(Math.abs(i.height - t.height)).toBeLessThanOrEqual(2)
      // The inline end, inside the list's 1 px border.
      expect(Math.abs(i.right - l.right)).toBeLessThanOrEqual(2)
    })

    // The panel fills the rest of the root's row, so its width does not
    // follow its content. Perturbation: dropping the panel's vertical
    // `flexGrow: 1` rule in `Tabs.css.ts` shrinks it to its text, short of
    // the root's inline end, and the two tabs' panels differ in width.
    const root = list.parentElement!
    const panelBox = () => canvas.getByRole('tabpanel').getBoundingClientRect()
    const settingsPanel = panelBox()
    await expect(
      Math.abs(settingsPanel.right - root.getBoundingClientRect().right),
    ).toBeLessThanOrEqual(1)
    await userEvent.click(canvas.getByRole('tab', { name: 'Billing' }))
    await waitFor(() => expect(canvas.getByRole('tabpanel')).toHaveTextContent('Billing panel'))
    await expect(Math.abs(panelBox().width - settingsPanel.width)).toBeLessThanOrEqual(1)
  },
}

/**
 * Review Focus 4 and R4: right to left. The same alignment check inside
 * `dir="rtl"`, then an RTL list that overflows (twelve tabs in 16rem), with
 * the first and the last tab selected in turn (the last one is scrolled to
 * by focus). Perturbations: dropping the `:dir(rtl)` rule leaves the
 * indicator at `left: var(--active-tab-left)` read as an inline-start inset,
 * which is the physical right in RTL, and fails the first check; reverting
 * the rule to `insetInlineStart: var(--active-tab-right)` passes the short
 * list but fails the overflowing one, because Base UI measures `right` from
 * `scrollWidth` (`TabsIndicator.js:89`).
 */
export const RightToLeft: Story = {
  render: (args) => (
    <div dir="rtl" style={{ padding: '2rem', display: 'grid', gap: '2rem' }}>
      <Tabs {...args} />
      <div style={{ inlineSize: '16rem' }}>
        <Tabs aria-label="Sections" items={MANY} />
      </div>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)

    await step('short list: the indicator follows tab 3', async () => {
      const list = canvas.getByRole('tablist', { name: 'Project' })
      const indicator = indicatorOf(list)
      const settings = within(list).getByRole('tab', { name: 'Account settings' })
      await userEvent.click(settings)
      await waitFor(() => expect(settings).toHaveAttribute('aria-selected', 'true'))
      await waitFor(() => expectInlineAligned(indicator, settings))
    })

    const list = canvas.getByRole('tablist', { name: 'Sections' })
    const indicator = indicatorOf(list)
    const first = within(list).getByRole('tab', { name: 'Quarterly section 1' })
    const last = within(list).getByRole('tab', { name: 'Quarterly section 12' })

    await step('overflowing list: first tab', async () => {
      await expect(list.scrollWidth).toBeGreaterThan(list.clientWidth)
      await waitFor(() => expectInlineAligned(indicator, first))
    })

    await step('overflowing list: last tab, scrolled to by focus', async () => {
      first.focus()
      // Loop focus: ArrowRight in RTL goes back, ArrowLeft forward. End is
      // direction-free.
      await userEvent.keyboard('{End}')
      await waitFor(() => expect(last).toHaveFocus())
      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(last).toHaveAttribute('aria-selected', 'true'))
      await waitFor(() => expect(list.scrollLeft).toBeLessThan(0))
      await waitFor(() => expectInlineAligned(indicator, last))
    })

    await step('overflowing list: back to the first tab', async () => {
      await userEvent.keyboard('{Home}')
      await waitFor(() => expect(first).toHaveFocus())
      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(first).toHaveAttribute('aria-selected', 'true'))
      await waitFor(() => expectInlineAligned(indicator, first))
    })
  },
}

/**
 * Review Focus 5: twelve tabs in a 16rem box. The list scrolls inside its own
 * box and the page does not scroll horizontally. Selecting the last tab from
 * the keyboard scrolls it into view and the indicator stays aligned with it.
 * Perturbations: `flexWrap: 'wrap'` on the horizontal list fails the
 * scroll-width check; dropping `overflowX: 'auto'` lets the row spill out and
 * fails the page check.
 */
export const Overflow: Story = {
  args: { items: MANY, 'aria-label': 'Sections' },
  render: (args) => (
    <div style={{ padding: '2rem' }}>
      <div style={{ inlineSize: '16rem' }}>
        <Tabs {...args} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole('tablist')
    const indicator = indicatorOf(list)
    const root = document.documentElement
    await expect(list.scrollWidth).toBeGreaterThan(list.clientWidth)
    // The row is wider than the page itself, so the next check has teeth.
    await expect(list.scrollWidth).toBeGreaterThan(root.clientWidth)
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)

    const last = canvas.getByRole('tab', { name: 'Quarterly section 12' })
    canvas.getByRole('tab', { name: 'Quarterly section 1' }).focus()
    await userEvent.keyboard('{End}')
    await waitFor(() => expect(last).toHaveFocus())
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(last).toHaveAttribute('aria-selected', 'true'))
    await waitFor(() => expect(list.scrollLeft).toBeGreaterThan(0))
    await waitFor(() => expectInlineAligned(indicator, last))
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
  },
}

/**
 * Review Focus 2: a disabled tab cannot be selected, by Enter or by a click.
 * The arrow keys do NOT skip it (observed, contrary to the plan's
 * expectation): Base UI makes a tab `focusableWhenDisabled`
 * (`tabs/tab/TabsTab.js:118`) and gives the list no disabled indices
 * (`tabs/list/TabsList.js:108`), so ArrowRight from tab 1 lands on tab 2,
 * which carries `aria-disabled="true"`, and a second ArrowRight reaches
 * tab 3. Perturbation: dropping `disabled` from tab 2 fails the
 * `aria-disabled` check; with that check also removed, Enter selects tab 2
 * and fails the not-selected check.
 */
export const DisabledTab: Story = {
  args: {
    items: [
      { value: 'one', label: 'One', content: 'Panel one' },
      { value: 'two', label: 'Two', content: 'Panel two', disabled: true },
      { value: 'three', label: 'Three', content: 'Panel three' },
    ],
  },
  render: (args) => (
    <div style={{ padding: '2rem' }}>
      <Tabs {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const one = canvas.getByRole('tab', { name: 'One' })
    const two = canvas.getByRole('tab', { name: 'Two' })
    const three = canvas.getByRole('tab', { name: 'Three' })

    one.focus()
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(two).toHaveFocus())
    await expect(two).toHaveAttribute('aria-disabled', 'true')
    await userEvent.keyboard('{Enter}')
    await new Promise((resolve) => setTimeout(resolve, 200))
    await expect(two).toHaveAttribute('aria-selected', 'false')
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(three).toHaveFocus())

    await userEvent.click(two)
    await new Promise((resolve) => setTimeout(resolve, 200))
    await expect(two).toHaveAttribute('aria-selected', 'false')
    await expect(one).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Panel one')
  },
}

const consoleErrors: string[] = []

/**
 * Tabs rendered as our own `Button` (`render={<Button variant="ghost" />}`):
 * the derived `nativeButton` keeps Base UI's button semantics, so each tab is
 * a `type="button"` with `role="tab"` and nothing is logged. The spy is
 * installed in `beforeEach` because Base UI's check runs on mount. Perturbation:
 * forcing `nativeButton={false}` in `TabsTab` makes Base UI log "A component
 * that acts as a button expected a non-<button>" once per tab and fails the
 * no-error check. (`type="button"` survives that perturbation, because our
 * `Button` sets its own `type`, so the attribute checks pin coexistence only.)
 */
export const WithButtonTabs: Story = {
  beforeEach: () => {
    consoleErrors.length = 0
    const original = console.error
    console.error = (...args: unknown[]) => {
      consoleErrors.push(String(args[0]))
      original(...args)
    }
    return () => {
      console.error = original
    }
  },
  render: () => (
    <div style={{ padding: '2rem' }}>
      <Tabs.Root defaultValue="one">
        <Tabs.List aria-label="Button tabs">
          <Tabs.Indicator />
          <Tabs.Tab value="one" render={<Button variant="ghost" />}>
            One
          </Tabs.Tab>
          <Tabs.Tab value="two" render={<Button variant="ghost" />}>
            Two
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one">Panel one</Tabs.Panel>
        <Tabs.Panel value="two">Panel two</Tabs.Panel>
      </Tabs.Root>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tabs = canvas.getAllByRole('tab')
    await expect(tabs).toHaveLength(2)
    for (const tab of tabs) {
      await expect(tab.tagName).toBe('BUTTON')
      await expect(tab).toHaveAttribute('type', 'button')
      await expect(tab).toHaveAttribute('role', 'tab')
    }
    await userEvent.click(canvas.getByRole('tab', { name: 'Two' }))
    await waitFor(() => expect(canvas.getByRole('tabpanel')).toHaveTextContent('Panel two'))
    await expect(consoleErrors).toEqual([])
  },
}

/**
 * Built from the public parts only, with no convenience component: Root,
 * List, Indicator, Tab and Panel compose on their own, the indicator follows
 * the selection and the panel swaps. Perturbation: omitting `Tabs.Indicator`
 * fails the indicator lookup.
 */
export const HandAssembled: Story = {
  render: () => (
    <div style={{ padding: '2rem' }}>
      <Tabs.Root defaultValue="a" variant="pills">
        <Tabs.List aria-label="Hand assembled">
          <Tabs.Indicator />
          <Tabs.Tab value="a">Alpha</Tabs.Tab>
          <Tabs.Tab value="b">Bravo</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a">Alpha panel</Tabs.Panel>
        <Tabs.Panel value="b">Bravo panel</Tabs.Panel>
      </Tabs.Root>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const indicator = indicatorOf(canvas.getByRole('tablist'))
    const bravo = canvas.getByRole('tab', { name: 'Bravo' })
    await userEvent.click(bravo)
    await waitFor(() => expect(canvas.getByRole('tabpanel')).toHaveTextContent('Bravo panel'))
    await waitFor(() => expectInlineAligned(indicator, bravo))
  },
}
