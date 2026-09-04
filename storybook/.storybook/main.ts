import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-vite'

// fileURLToPath, not new URL(...).pathname: on Windows the latter yields
// "/D:/dev/..." with a leading slash, and every fs.allow check then misses.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: [
    '../../packages/react/src/**/*.stories.@(ts|tsx)',
    '../docs/**/*.mdx',
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  // forwardRef + Omit<> props are invisible to the default react-docgen, which
  // would leave every component's Controls panel empty.
  typescript: { reactDocgen: 'react-docgen-typescript' },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite')
    const { vanillaExtractPlugin } = await import('@vanilla-extract/vite-plugin')
    return mergeConfig(config, {
      // A GitHub Pages project site is served from /<repo>/, not the domain
      // root, and Storybook's Vite builder does not fully rewrite asset URLs
      // for a subpath on its own. This is read from the environment rather
      // than hardcoded because gate 9 serves the same static build from a
      // local server at the domain root: hardcoding the subpath would break
      // every screenshot while the deployed site worked, or the reverse.
      base: process.env.STORYBOOK_BASE_PATH ?? '/',
      plugins: [vanillaExtractPlugin()],
      // Stories live outside this workspace, in packages/react/src.
      server: { fs: { allow: [repoRoot] } },
    })
  },
}
export default config
