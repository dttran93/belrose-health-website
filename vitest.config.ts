import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@belrose/shared': path.resolve(__dirname, './packages/shared/src'),
    },
  },
  test: {
    // Default stays 'node' for the plain service unit tests (fast, no DOM needed).
    // Component/hook tests opt into jsdom per-file via a `// @vitest-environment jsdom`
    // comment at the top of the file — no need for a whole separate config, since (unlike
    // rules/orchestration/e2e) this tier needs no extra process, just a DOM in-process.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // contracts/ and functions/ have their own separate test runners (Hardhat, none yet)
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
