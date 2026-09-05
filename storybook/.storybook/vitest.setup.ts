import { beforeAll } from 'vitest'
import { setProjectAnnotations } from '@storybook/react-vite'
import * as a11yAnnotations from '@storybook/addon-a11y/preview'
import * as preview from './preview'

// Feeds the preview's decorators and parameters into the browser test run.
// Without the a11y annotations, axe never runs and gate 5 is vacuous.
//
// Order matters: `@storybook/addon-a11y/preview` ships its own default
// parameter, `a11y.test: 'todo'` (warn-only). Storybook's project-annotation
// merge resolves a conflicting scalar by taking the LAST entry in the array,
// so whichever of these two sources is listed last wins. The addon must
// come first and `preview` (with our `a11y.test: 'error'`) must come last,
// matching Storybook's own automatic composer order (addon annotations,
// then the user's preview file). Reversing this order does not error or
// warn — every story still passes — it just silently turns gate 5 into a
// no-op. Proven empirically in Task 4: see docs/CONTRIBUTING.md, "Gate 5
// runs inside the story run".
const annotations = setProjectAnnotations([a11yAnnotations, preview])
beforeAll(annotations.beforeAll)
