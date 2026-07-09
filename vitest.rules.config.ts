import { defineConfig } from 'vitest/config';

// Separate from vitest.config.ts — these tests need a running Firestore emulator
// (started via `firebase emulators:exec`, see the "test:rules" npm script), so they're
// kept out of the plain `npm run test` pure-function suite.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/rules/**/*.test.ts'],
    // Rules-unit-testing setup/teardown talks to the emulator over the network — give it
    // more headroom than the default 5s.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
