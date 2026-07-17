// functions/test/setup.ts
//
// Runs before any test file. Handler modules read admin.auth()/admin.firestore() at
// call time, and those lazily resolve to the default app the first time they're
// touched — so the emulator env vars and admin.initializeApp() must both happen here,
// before any test file imports a handler.

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'belrose-functions-test' });
}
