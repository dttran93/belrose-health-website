import { defineConfig } from 'vitest/config';

// New 5th test layer (see root CLAUDE.md context / test plan): exercises Cloud
// Functions handlers directly via their `.run()` method against the real Auth +
// Firestore emulators (see root firebase.json — ports 8080/9099), with the
// functions emulator itself never started since handlers run in-process here.
// Kept inside functions/ (its own package, own firebase-admin/ethers versions)
// rather than under root test/, mirroring this repo's existing convention that
// functions/ and contracts/ own their own test runners.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
