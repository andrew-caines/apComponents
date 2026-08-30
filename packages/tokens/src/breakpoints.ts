// Shared singletons, frozen at declaration (see scales.ts).
export const breakpoints = Object.freeze({ sm: 640, md: 768, lg: 1024, xl: 1280 } as const)

export const media = Object.freeze({
  sm: `(min-width: ${breakpoints.sm}px)`,
  md: `(min-width: ${breakpoints.md}px)`,
  lg: `(min-width: ${breakpoints.lg}px)`,
  xl: `(min-width: ${breakpoints.xl}px)`,
  coarse: '(pointer: coarse)',
} as const)
