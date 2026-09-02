export { vars } from './theme/contract.css.js'
export { tier3 } from './theme/tier3.js'
export { Surface, SURFACE_TOKENS } from './components/Surface/index.js'
export type { SurfaceProps } from './components/Surface/index.js'
export { useHydrated, useIsomorphicLayoutEffect } from './hooks/index.js'
export {
  ThemeProvider,
  useTheme,
  useColorScheme,
  DEFAULT_SCHEME_STORAGE_KEY,
} from './providers/ThemeProvider.js'
export type { ColorScheme, ThemeContextValue, ThemeProviderProps } from './providers/ThemeProvider.js'
export { ThemeScript } from './providers/ThemeScript.js'
