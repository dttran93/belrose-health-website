import { defineConfig } from 'vitest/config';
import path from 'path';

// Layer 3 of the permissions test suite: PermissionsService orchestration.
// Real Firestore emulator (permissive rules — see test/orchestration/permissive.rules),
// but BlockchainRoleManagerService/SharingService/firebase-auth are mocked per test file.
// Kept separate from vitest.config.ts (needs a running emulator) and vitest.rules.config.ts
// (different emulator project/port — see the "test:orchestration" npm script).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@belrose/shared': path.resolve(__dirname, './packages/shared/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/orchestration/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
