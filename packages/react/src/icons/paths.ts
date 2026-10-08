/**
 * The icons the components actually render: five from Phase 4, plus
 * `check-circle` and `alert-triangle`, which Phase 5f's Toast and Banner render
 * for the success and warning severities. Deliberately not the eventual
 * fifteen: an icon nothing renders is speculative work and a permanent
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
  'check-circle': 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 12l3 3 5-6',
  'alert-triangle':
    'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',
})

export type IconName = keyof typeof ICON_PATHS
