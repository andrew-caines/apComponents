import { Accordion, Tabs } from '@ap/react'
import { Page, Specimen } from '../Page.js'

export default function DisclosurePage() {
  return (
    <Page slug="disclosure">
      <Specimen label="tabs">
        <Tabs
          aria-label="Employee sections"
          items={[
            { value: 'profile', label: 'Profile', content: 'Profile content' },
            { value: 'pay', label: 'Pay', content: 'Pay content' },
            { value: 'leave', label: 'Leave', content: 'Leave content' },
          ]}
        />
      </Specimen>

      <Specimen label="accordion">
        <Accordion
          items={[
            { value: 'one', title: 'First', content: 'First content' },
            { value: 'two', title: 'Second', content: 'Second content' },
            { value: 'three', title: 'Third', content: 'Third content' },
          ]}
        />
      </Specimen>
    </Page>
  )
}
