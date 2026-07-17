// functions/test/setup.ts
//
// Runs before any test file. Handler modules read admin.auth()/admin.firestore() at
// call time, and those lazily resolve to the default app the first time they're
// touched — so the emulator env vars and admin.initializeApp() must both happen here,
// before any test file imports a handler.

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

// Handlers that sign on-chain transactions (memberRegistry.ts, createDependentAccount.ts) read
// ADMIN_WALLET_PRIVATE_KEY directly via process.env — the `secrets: [...]` onCall option only
// injects secrets through the real Functions emulator/deployment, not when calling `.run()`
// in-process as these tests do. A syntactically-valid but fake key is enough: the contract
// binding itself is always mocked in these tests, so this wallet is never used to sign or send
// anything for real.
process.env.ADMIN_WALLET_PRIVATE_KEY =
  process.env.ADMIN_WALLET_PRIVATE_KEY || '0x' + '11'.repeat(32);
process.env.RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:0';

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'belrose-functions-test' });
}
