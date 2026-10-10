import type { Preview } from '@storybook/react-vite'
import { ApProvider } from '@ap/react'
import '@ap/react/fonts.css'
import '@ap/react/theme.css'
import '@ap/react/motion.css'
import './preview.css'

const preview: Preview = {
  // Every story renders inside the provider stack. This is not decoration:
  // Dialog.Dismiss reads its aria-label from the message registry via
  // useMessages(), and throws outside a LocaleProvider.
  //
  // It is also the ONE NotificationProvider a story gets. A provider a story
  // mounts itself is nested inside this one, and a nested provider renders
  // only its children, so its `placement` would be ignored. A story picks its
  // toast placement with `parameters: { notifications: { placement } }`.
  decorators: [
    (Story, context) => (
      <ApProvider
        notifications={{ placement: context.parameters.notifications?.placement ?? 'bottom-end' }}
      >
        <Story />
      </ApProvider>
    ),
  ],
  parameters: {
    a11y: {
      // 'error' fails the test run on a violation. 'todo' only warns in the
      // UI, which would make gate 5 a suggestion.
      test: 'error',
      // The same WCAG tag set the retired showcase spec used — unchanged by
      // this move. (The scanned surface did change: see CONTRIBUTING's
      // "Gate 5 no longer lives here".)
      options: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } },
    },
  },
}
export default preview
