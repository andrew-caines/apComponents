import { Accordion, Input, Tabs } from '@ap/react'

/**
 * The surface the Tabs and Accordion SSR and hydration checks assert against.
 *
 * This route needs no provider: neither component reads a message or a theme
 * (all of their text is consumer content), so there is nothing a provider
 * would supply here.
 *
 * Routed in both SSR and SPA modes: it exports no loader and no action.
 */
export default function DisclosureRoute() {
  return (
    <main>
      <h1>disclosure</h1>
      <section id="tabs-host">
        <Tabs
          aria-label="Employee sections"
          items={[
            { value: 'profile', label: 'Profile', content: <p id="tab-profile">Profile content</p> },
            { value: 'pay', label: 'Pay', content: <p id="tab-pay">Pay content</p> },
            { value: 'leave', label: 'Leave', content: <p id="tab-leave">Leave content</p> },
          ]}
        />
      </section>
      <section id="accordion-host">
        <Accordion
          items={[
            { value: 'one', title: 'First', content: <p id="acc-one">First content</p> },
            {
              value: 'two',
              title: 'Second',
              content: <Input name="acc" id="acc-input" aria-label="Accordion input" />,
            },
            { value: 'three', title: 'Third', content: <p id="acc-three">Third content</p> },
          ]}
        />
      </section>
    </main>
  )
}
