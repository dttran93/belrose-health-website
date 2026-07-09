import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Vite's dev server loads .env.local automatically for the frontend, but this config file
// runs in Playwright's own Node process, which doesn't — load it explicitly so
// process.env.VITE_FIREBASE_PROJECT_ID (read by e2e/signup.spec.ts) is populated too.
loadEnv({ path: '.env.local' });

// Thin E2E layer (see the "layered test suite" discussion) — the only layer that drives a
// real browser against the real frontend, real Firestore/Auth emulators, and the real
// signSponsorship Cloud Function talking to real Base Sepolia + Pimlico. Deliberately kept
// to a handful of the highest-value flows; the combinatorial matrix lives in
// contracts/test, test/rules, and test/orchestration instead.
//
// Requires Auth + Firestore + Functions emulators running (see the "test:e2e" npm script,
// which wraps this in `firebase emulators:exec`) and functions/.env populated with real
// Pimlico/Alchemy credentials, since the Functions emulator's signSponsorship code still
// makes real network calls out to Base Sepolia regardless of where the function runs.
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
  },
  webServer: {
    // A dedicated port + reuseExistingServer: false, on purpose — your normal `npm run dev`
    // likely already has 5173 occupied and talks to real production Firestore. Reusing an
    // already-running server here (the Playwright default when not in CI) would silently
    // run these tests against production instead of the emulators. Always launch a fresh,
    // correctly-configured server on its own port instead.
    command: 'npm run dev -- --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    env: { VITE_USE_EMULATOR: 'true' },
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
