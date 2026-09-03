import { index, route, type RouteConfig } from '@react-router/dev/routes'
import { SECTIONS } from './sections.js'

// Derived, never hand-maintained — see the note in `sections.ts`.
export default [
  index('routes/home.tsx'),
  ...SECTIONS.map((s) => route(s.slug, s.file)),
] satisfies RouteConfig
