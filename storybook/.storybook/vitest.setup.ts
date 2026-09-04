import { beforeAll } from 'vitest'
import { setProjectAnnotations } from '@storybook/react-vite'
import * as a11yAnnotations from '@storybook/addon-a11y/preview'
import * as preview from './preview'

// Feeds the preview's decorators and parameters into the browser test run.
// Without the a11y annotations, axe never runs and gate 5 is vacuous.
const annotations = setProjectAnnotations([preview, a11yAnnotations])
beforeAll(annotations.beforeAll)
