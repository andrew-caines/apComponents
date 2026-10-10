import { defineConfig } from '@playwright/test'

// Gate 9 (spec §6.2, §6.3.2). Advisory; baselines are Linux-only and made only by
// .github/workflows/visual-baselines.yml.
const shared = {
  viewport: { width: 1024, height: 768 },
  deviceScaleFactor: 1,
  // Not 'reduce': the plays are gate 4's tests and are written for full motion
  // (spec §6.3.2). `animations: 'disabled'` on the screenshot freezes the frame.
  reducedMotion: 'no-preference' as const,
}

export default defineConfig({
  testDir: '.',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  // Paths here resolve against this file's directory, so both land in
  // storybook/test-results/, which CI uploads and summary.ts reads. Left to
  // its default, outputDir would be storybook/visual/test-results/.
  outputDir: '../test-results/visual',
  fullyParallel: true,
  reporter: [['list'], ['json', { outputFile: '../test-results/visual.json' }]],
  use: {
    // vite preview binds IPv6 only; 127.0.0.1 would not connect.
    baseURL: 'http://localhost:6007',
  },
  webServer: {
    command: 'npx vite preview --outDir storybook-static --port 6007 --strictPort',
    cwd: '..',
    url: 'http://localhost:6007/index.json',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'light', use: { ...shared, colorScheme: 'light' } },
    { name: 'dark', use: { ...shared, colorScheme: 'dark' } },
  ],
})
