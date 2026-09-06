import type { Preview } from '@storybook/react-vite'
import { ApProvider } from '@ap/react'
import '@ap/react/fonts.css'
import '@ap/react/theme.css'
import '@ap/react/motion.css'

const preview: Preview = {
  // Every story renders inside the provider stack. This is not decoration:
  // Dialog.Dismiss reads its aria-label from the message registry via
  // useMessages(), and throws outside a LocaleProvider.
  decorators: [(Story) => <ApProvider><Story /></ApProvider>],
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
