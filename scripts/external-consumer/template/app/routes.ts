import { route, type RouteConfig } from '@react-router/dev/routes'

export default [
  route('form', 'routes/form.tsx'),
  route('dialog', 'routes/dialog.tsx'),
  route('overlays', 'routes/overlays.tsx'),
] satisfies RouteConfig
