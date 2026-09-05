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
    const reactPkgRoot = join(repoRoot, 'packages', 'react')
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
      resolve: {
        alias: [
          // `preview.tsx` imports `ApProvider` through the bare specifier
          // `@ap/react`, which resolves via the `node_modules/@ap/react`
          // symlink; every story imports the same source through a plain
          // relative path (`../../providers/...`) that never touches that
          // symlink. Left alone, Vite can hand these two import styles two
          // different module identities for what is on disk the same file —
          // and since `LocaleContext` is created with `createContext()` at
          // module scope, two identities mean two contexts, so `ApProvider`'s
          // provider (registered via the first identity) does not satisfy
          // `useContext` calls made through the second. That surfaced as
          // Dialog.Dismiss throwing "useLocale must be used inside
          // <LocaleProvider>" even with the ApProvider decorator wired up
          // correctly in preview.tsx and confirmed present in the composed
          // project annotations. Aliasing the bare specifiers straight to
          // their real source files removes the symlink hop entirely, so both
          // import styles resolve to the identical id.
          { find: '@ap/react/theme.css', replacement: join(reactPkgRoot, 'src/theme/theme.css') },
          { find: '@ap/react/fonts.css', replacement: join(reactPkgRoot, 'src/theme/fonts.css') },
          { find: '@ap/react/motion.css', replacement: join(reactPkgRoot, 'src/theme/motion.css') },
          { find: '@ap/react', replacement: join(reactPkgRoot, 'src/index.ts') },
        ],
      },
    })
  },
}
export default config
