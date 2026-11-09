import { defineConfig } from 'vitest/config';

// BASE lets the build target an arcade subpath. The default is relative, so the
// same build also works from any folder on static hosting.
export default defineConfig({
  base: process.env.BASE ?? './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
  },
});
