import { useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { cssKeyframeName } from '@ap/motion'
import { Button } from '../Button/Button.js'
import { Input } from '../Input/Input.js'
import { Accordion, type AccordionSection } from './Accordion.js'

const ITEMS: ReadonlyArray<AccordionSection> = [
  { value: 'shipping', title: 'Shipping', content: 'We ship within two working days.' },
  { value: 'returns', title: 'Returns', content: 'Return any item within thirty days.' },
  { value: 'warranty', title: 'Warranty', content: 'Every item carries a two-year warranty.' },
]

const meta = {
  title: 'Components/Accordion',
  component: Accordion,
  args: { items: ITEMS },
} satisfies Meta<typeof Accordion>

export default meta
type Story = StoryObj<typeof meta>

const EXPAND = cssKeyframeName('expand')
const COLLAPSE = cssKeyframeName('collapse')

/** Every panel, open or closed: a closed one is `hidden`, so `hidden: true`. */
const panelsOf = (canvas: ReturnType<typeof within>): HTMLElement[] =>
  canvas.getAllByRole('region', { hidden: true })

/** The chevron is the trigger's own `<svg>`, rendered after its label. */
const chevronOf = (trigger: HTMLElement): Element => {
  const el = trigger.querySelector(':scope > svg')
  if (el === null) throw new Error('no chevron inside the trigger')
  return el
}

/**
 * The unfinished CSS animation with this keyframe name, if any. The motion
 * tokens fill `both` (`packages/motion/src/emitCss.ts`), so a finished one
 * stays in `getAnimations()`; only its play state says it is over.
 */
const animationNamed = (el: HTMLElement, name: string): CSSAnimation | undefined =>
  el
    .getAnimations()
    .find(
      (a): a is CSSAnimation =>
        a instanceof CSSAnimation && a.animationName === name && a.playState !== 'finished',
    )

/** True once nothing on the element is still animating. */
const settled = (el: HTMLElement) => el.getAnimations().every((a) => a.playState === 'finished')

/**
 * One press of Tab, decided by the browser's own focusability. `userEvent.tab()`
 * cannot prove this: it picks the next element by selector alone
 * (`@testing-library/user-event`'s `getTabDestination.js`), so it targets an
 * input inside a `hidden="until-found"` panel, Chrome refuses the focus, and
 * focus stays put (observed). Here each later candidate in document order
 * (every one has `tabIndex` 0) is offered focus, and the first the browser
 * accepts is where Tab goes.
 */
const tabFrom = (from: HTMLElement, scope: HTMLElement): Element | null => {
  const candidates = Array.from(
    scope.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'),
  ).filter((el) => el.tabIndex >= 0)
  for (const el of candidates.slice(candidates.indexOf(from) + 1)) {
    el.focus()
    if (document.activeElement === el) return el
  }
  return null
}

const blockSize = (el: Element) => el.getBoundingClientRect().height

/**
 * Click a trigger and its panel opens: `aria-expanded` flips, the chevron's
 * computed `rotate` goes from `none` to `180deg` (after its transition), and
 * then the panel is visible with its content. Perturbation: deleting the
 * chevron's `'[data-panel-open] > &': { rotate: '180deg' }` rule leaves
 * `rotate` at `none` and fails the rotate check.
 */
export const Default: Story = {
  render: (args) => (
    <div style={{ padding: '2rem', maxInlineSize: '32rem' }}>
      <Accordion {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Returns' })
    const chevron = chevronOf(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(getComputedStyle(chevron).rotate).toBe('none')

    await userEvent.click(trigger)
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))
    await waitFor(() => expect(getComputedStyle(chevron).rotate).toBe('180deg'))
    const panel = await canvas.findByRole('region', { name: 'Returns' })
    await waitFor(() => expect(panel).toBeVisible())
    await expect(panel).toHaveTextContent('Return any item within thirty days.')
  },
}

/**
 * `headingLevel={2}` renders every header as an `<h2>`, one per item, and
 * no `<h3>` is left. Perturbation: mapping `2` to `<h3 />` in `HEADINGS`
 * (`Accordion.tsx`) fails the count.
 */
export const HeadingLevel: Story = {
  args: { headingLevel: 2 },
  render: (args) => (
    <div style={{ padding: '2rem', maxInlineSize: '32rem' }}>
      <Accordion {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const headings = canvas.getAllByRole('heading', { level: 2 })
    await expect(headings).toHaveLength(ITEMS.length)
    await expect(canvas.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
    for (const [i, heading] of headings.entries()) {
      await expect(heading).toHaveTextContent(String(ITEMS[i]?.title))
    }
  },
}

/** Content with a fixed block size, so the panel's full height is known. */
const TALL: ReadonlyArray<AccordionSection> = [
  {
    value: 'tall',
    title: 'Tall section',
    content: <div style={{ blockSize: '10rem' }}>Tall content</div>,
  },
]

/**
 * The open and the close are both real, height-animating keyframes.
 *
 * Open: while opening, the panel runs `expand` (`cssKeyframeName('expand')`)
 * and its `--panel-height` resolves to a pixel value equal to the content
 * height (`scrollHeight`, which `overflow: hidden` does not change). The
 * animation is paused at 40% of its time and the panel measured: strictly
 * between zero and the content height. At the end the height equals
 * `scrollHeight`. Pausing and seeking (`currentTime`) makes the sample
 * deterministic; nothing depends on frame timing.
 *
 * Close (R6): after the close click the panel is still mounted and not
 * hidden, running `collapse`; paused halfway it is again strictly between
 * zero and full. Then it ends hidden (`until-found`, as the convenience
 * component keeps closed panels mounted) with every animation finished.
 *
 * Perturbations: removing the `vars: { '--panel-height': … }` alias from
 * `accordionPanelClass` leaves `--panel-height` empty and fails the pixel
 * check; with that check also removed, the 40% sample fails too, because the
 * `height: var(--panel-height)` keyframe is invalid and the panel shows no
 * intermediate height (observed: 176px, the full height, at 40%). Keying
 * `collapse` on `&[data-ending-style]` instead of `&[data-closed]` gives the
 * close-request commit no animation, Base UI hides the panel at once
 * (`collapsible/panel/useCollapsiblePanel.js:187-189`), and the
 * still-mounted-with-collapse check fails.
 */
export const Motion: Story = {
  args: { items: TALL },
  render: (args) => (
    <div style={{ padding: '2rem', maxInlineSize: '32rem' }}>
      <Accordion {...args} />
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Tall section' })
    const [panel] = panelsOf(canvas)
    if (panel === undefined) throw new Error('no panel')

    let full = 0
    await step('open runs expand from --panel-height', async () => {
      await userEvent.click(trigger)
      // The animation is caught well inside its 200ms (`duration.base`).
      const expand = await waitFor(() => {
        const a = animationNamed(panel, EXPAND)
        expect(a).toBeDefined()
        return a as CSSAnimation
      })
      expand.pause()
      // The content height, which `overflow: hidden` does not change: the
      // reference the animation is measured against, independent of the alias.
      full = panel.scrollHeight
      await expect(full).toBeGreaterThan(100)
      const style = getComputedStyle(panel)
      await expect(style.animationName).toBe(EXPAND)
      const panelHeight = style.getPropertyValue('--panel-height').trim()
      await expect(panelHeight).toMatch(/^\d+(\.\d+)?px$/)
      await expect(Math.abs(Number.parseFloat(panelHeight) - full)).toBeLessThanOrEqual(0.5)
      // 40% of `duration.base` (200ms).
      expand.currentTime = 80
      const mid = blockSize(panel)
      await expect(mid).toBeGreaterThan(0)
      await expect(mid).toBeLessThan(full)
      expand.play()
    })

    await step('the open ends at the content height', async () => {
      await waitFor(() => expect(settled(panel)).toBe(true))
      await expect(panel.hasAttribute('hidden')).toBe(false)
      await expect(Math.abs(blockSize(panel) - panel.scrollHeight)).toBeLessThanOrEqual(0.5)
      await expect(Math.abs(blockSize(panel) - full)).toBeLessThanOrEqual(0.5)
    })

    await step('close runs collapse on a still-mounted panel', async () => {
      await userEvent.click(trigger)
      const collapse = await waitFor(() => {
        const a = animationNamed(panel, COLLAPSE)
        expect(a).toBeDefined()
        return a as CSSAnimation
      })
      await expect(panel.hasAttribute('hidden')).toBe(false)
      collapse.pause()
      // Half of `duration.fast` (120ms).
      collapse.currentTime = 60
      const mid = blockSize(panel)
      await expect(mid).toBeGreaterThan(0)
      await expect(mid).toBeLessThan(full)
      collapse.play()
    })

    await step('the close ends hidden until found', async () => {
      await waitFor(() => expect(panel.getAttribute('hidden')).toBe('until-found'))
      await waitFor(() => expect(settled(panel)).toBe(true))
      await expect(blockSize(panel)).toBe(0)
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })
  },
}

/** Mounts its children on click, so a play can watch a mount itself. */
function MountToggle({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false)
  return (
    <>
      <Button variant="ghost" onClick={() => setShown((s) => !s)}>
        Show accordion
      </Button>
      {shown ? children : null}
    </>
  )
}

/**
 * Spec §4.5.1's client half, in a real browser. The accordion mounts on a
 * click; the closed panels' first observed state is `hidden="until-found"`
 * with a zero block size, and every sampled frame for 300ms keeps it zero:
 * a panel closed on mount shows nothing. (What is asserted is the observable
 * size, not the absence of an animation: `collapse` may run zero-to-zero
 * under the UA's `content-visibility: hidden`, see `Accordion.css.ts`.)
 * Dispatching `beforematch` on a closed panel, which is what the browser does
 * on a find-in-page match, opens its item.
 * Perturbations: moving `paddingBlockEnd` from the content box onto
 * `accordionPanelClass` gives a closed, border-box panel a non-zero block
 * size and fails the zero-size check; removing `hiddenUntilFound` from the
 * convenience root unmounts closed panels and fails the `until-found` check.
 */
export const FindInPage: Story = {
  render: (args) => (
    <div style={{ padding: '2rem', maxInlineSize: '32rem' }}>
      <MountToggle>
        <Accordion {...args} />
      </MountToggle>
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Show accordion' }))
    const panels = await waitFor(() => {
      const found = panelsOf(canvas)
      expect(found).toHaveLength(ITEMS.length)
      return found
    })

    await step('closed panels are hidden until found and take no space', async () => {
      // `until-found` is set in a layout effect, before the first paint.
      for (const panel of panels) {
        await expect(panel.getAttribute('hidden')).toBe('until-found')
        await expect(blockSize(panel)).toBe(0)
      }
      const sizes: number[] = []
      const end = performance.now() + 300
      while (performance.now() < end) {
        await new Promise((resolve) => requestAnimationFrame(resolve))
        for (const panel of panels) sizes.push(blockSize(panel))
      }
      await expect(sizes.length).toBeGreaterThan(0)
      await expect(Math.max(...sizes)).toBe(0)
    })

    await step('beforematch opens the item', async () => {
      const panel = panels[1] as HTMLElement
      const trigger = canvas.getByRole('button', { name: 'Returns' })
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
      panel.dispatchEvent(new Event('beforematch', { bubbles: true }))
      await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))
      await waitFor(() => expect(panel.hasAttribute('hidden')).toBe(false))
      await waitFor(() => expect(panel).toBeVisible())
      await expect(panel).toHaveTextContent('Return any item within thirty days.')
    })
  },
}

/**
 * Review Focus 3: a closed panel's `<input>` is out of the tab order. From
 * the first trigger, Tab (`tabFrom`, the browser's own focusability; see why
 * not `userEvent.tab()` there) goes to the second trigger. After opening the
 * first item, Tab reaches the input; the ring is checked on that focus,
 * which matches `:focus-visible` (the computed `outline-style` is `solid`,
 * only set under `:focus-visible`). Its focus ring then fits inside the panel:
 * the ring's block-start edge (the input's top minus its computed
 * `outline-offset` plus `outline-width`) is at or below the panel's top, so
 * the panel's always-on `overflow: hidden` does not clip it.
 * Perturbations: adding `contentVisibility: 'visible'` to
 * `accordionPanelClass` overrides the UA's `until-found` rule, the closed
 * input becomes focusable and the first Tab lands on it; removing the content
 * box's `paddingBlockStart` puts the input at the panel's top edge and fails
 * the ring check.
 */
export const HiddenFocus: Story = {
  args: {
    items: [
      {
        value: 'contact',
        title: 'Contact',
        content: <Input aria-label="Email address" />,
      },
      { value: 'notes', title: 'Notes', content: 'Nothing to add.' },
    ],
  },
  render: (args) => (
    <div style={{ padding: '2rem', maxInlineSize: '32rem' }}>
      <Accordion {...args} />
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const contact = canvas.getByRole('button', { name: 'Contact' })
    const notes = canvas.getByRole('button', { name: 'Notes' })

    await step('Tab skips the closed panel', async () => {
      await expect(tabFrom(contact, canvasElement)).toBe(notes)
      await expect(notes).toHaveFocus()
    })

    await step('after opening, Tab reaches the input', async () => {
      await userEvent.click(contact)
      await waitFor(() => expect(contact).toHaveAttribute('aria-expanded', 'true'))
      const panel = canvas.getByRole('region', { name: 'Contact' })
      // Measure the settled panel, not a frame of `expand`.
      await waitFor(() => expect(settled(panel)).toBe(true))
      const input = canvas.getByRole('textbox', { name: 'Email address' })
      await expect(tabFrom(contact, canvasElement)).toBe(input)
      await expect(input).toHaveFocus()

      const style = getComputedStyle(input)
      await expect(style.outlineStyle).toBe('solid')
      const reach = Number.parseFloat(style.outlineOffset) + Number.parseFloat(style.outlineWidth)
      await expect(reach).toBeGreaterThan(0)
      const ringTop = input.getBoundingClientRect().top - reach
      await expect(ringTop).toBeGreaterThanOrEqual(panel.getBoundingClientRect().top - 0.5)
    })
  },
}

/**
 * `multiple`: opening a second item leaves the first open. Perturbation:
 * dropping `multiple` closes the first item and fails its `aria-expanded`
 * check.
 */
export const Multiple: Story = {
  args: { multiple: true },
  render: (args) => (
    <div style={{ padding: '2rem', maxInlineSize: '32rem' }}>
      <Accordion {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const shipping = canvas.getByRole('button', { name: 'Shipping' })
    const returns = canvas.getByRole('button', { name: 'Returns' })
    await userEvent.click(shipping)
    await waitFor(() => expect(shipping).toHaveAttribute('aria-expanded', 'true'))
    await userEvent.click(returns)
    await waitFor(() => expect(returns).toHaveAttribute('aria-expanded', 'true'))
    // Give a single-open close time to land before checking it did not.
    await new Promise((resolve) => setTimeout(resolve, 200))
    await expect(shipping).toHaveAttribute('aria-expanded', 'true')
    const open = panelsOf(canvas).filter((p) => !p.hasAttribute('hidden'))
    await expect(open).toHaveLength(2)
  },
}

/**
 * A disabled item stays closed when its trigger is clicked. Base UI keeps the
 * trigger focusable (`focusableWhenDisabled: true`,
 * `accordion/trigger/AccordionTrigger.js:40-45`) and marks it
 * `aria-disabled`. Perturbation: dropping `disabled` from the item fails the
 * `aria-disabled` check; with that check also removed, the click opens it and
 * fails the still-closed check.
 */
export const DisabledItem: Story = {
  args: {
    items: [
      ITEMS[0] as AccordionSection,
      { value: 'locked', title: 'Locked', content: 'Not available.', disabled: true },
    ],
  },
  render: (args) => (
    <div style={{ padding: '2rem', maxInlineSize: '32rem' }}>
      <Accordion {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const locked = canvas.getByRole('button', { name: 'Locked' })
    await expect(locked).toHaveAttribute('aria-disabled', 'true')
    await expect(locked).toHaveAttribute('data-disabled')
    await userEvent.click(locked)
    await new Promise((resolve) => setTimeout(resolve, 200))
    await expect(locked).toHaveAttribute('aria-expanded', 'false')
    const open = panelsOf(canvas).filter((p) => !p.hasAttribute('hidden'))
    await expect(open).toHaveLength(0)
  },
}

const consoleErrors: string[] = []

/**
 * Triggers rendered as our own `Button` (`render={<Button variant="ghost" />}`):
 * the derived `nativeButton` keeps Base UI's button semantics, the click
 * opens the panel, and nothing is logged. The spy is installed in
 * `beforeEach` because Base UI's check runs on mount. Perturbation: forcing
 * `nativeButton={false}` in `AccordionTrigger` makes Base UI log "A component
 * that acts as a button expected a non-<button>" and fails the no-error
 * check.
 */
export const WithButtonTrigger: Story = {
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
    <div style={{ padding: '2rem', maxInlineSize: '32rem' }}>
      <Accordion.Root>
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger render={<Button variant="ghost" />}>One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel one</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="two">
          <Accordion.Header>
            <Accordion.Trigger render={<Button variant="ghost" />}>Two</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel two</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const triggers = canvas.getAllByRole('button')
    await expect(triggers).toHaveLength(2)
    for (const trigger of triggers) {
      await expect(trigger.tagName).toBe('BUTTON')
      await expect(trigger).toHaveAttribute('type', 'button')
    }
    const two = canvas.getByRole('button', { name: 'Two' })
    await userEvent.click(two)
    await waitFor(() => expect(two).toHaveAttribute('aria-expanded', 'true'))
    await waitFor(() =>
      expect(canvas.getByRole('region', { name: 'Two' })).toHaveTextContent('Panel two'),
    )
    await expect(consoleErrors).toEqual([])
  },
}

/**
 * Built from the public parts only, with the heading level set by hand
 * through `Header render={<h4 />}`: two `<h4>` headers, and a click opens the
 * panel. Perturbation: dropping `render` from either header leaves an `<h3>`
 * and fails the level-4 count.
 */
export const HandAssembled: Story = {
  render: () => (
    <div style={{ padding: '2rem', maxInlineSize: '32rem' }}>
      <Accordion.Root>
        <Accordion.Item value="a">
          <Accordion.Header render={<h4 />}>
            <Accordion.Trigger>Alpha</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Alpha panel</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Header render={<h4 />}>
            <Accordion.Trigger>Bravo</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Bravo panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('heading', { level: 4 })).toHaveLength(2)
    await expect(canvas.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
    const bravo = canvas.getByRole('button', { name: 'Bravo' })
    await userEvent.click(bravo)
    await waitFor(() =>
      expect(canvas.getByRole('region', { name: 'Bravo' })).toHaveTextContent('Bravo panel'),
    )
  },
}
