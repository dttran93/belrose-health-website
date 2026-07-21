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
    // Every test file shares ONE Admin SDK app / ONE emulator project (test/setup.ts calls
    // admin.initializeApp() once) — unlike the orchestration/rules layers, which give each test
    // FILE its own unique Firestore project specifically so parallel files can't collide. Admin
    // SDK doesn't offer an equivalent per-file trick here, so file-level parallelism must be
    // disabled: without this, two files' beforeEach clearFirestore()/deleteAllAuthUsers() (or
    // just reused fixture uids like 'dep-1'/'guardian-1') race and corrupt each other's data.
    fileParallelism: false,
  },
});
