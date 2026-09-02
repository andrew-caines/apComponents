/**
 * The five icons Phase 4's components actually render. Deliberately not the
 * eventual fifteen: an icon nothing renders is speculative work and a permanent
 * maintenance obligation.
 *
 * All are drawn on a 24×24 grid with a 2px stroke, so they sit consistently
 * against text at any size.
 */
export const ICON_PATHS = Object.freeze({
  check: 'M20 6 9 17l-5-5',
  close: 'M18 6 6 18M6 6l12 12',
  'chevron-down': 'm6 9 6 6 6-6',
  'alert-circle': 'M12 8v5M12 16h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  info: 'M12 16v-5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
})

export type IconName = keyof typeof ICON_PATHS
