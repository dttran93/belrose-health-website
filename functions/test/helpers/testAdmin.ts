// functions/test/helpers/testAdmin.ts
//
// Thin wrapper around the emulator REST APIs for resetting state between tests.
// admin.firestore()/admin.auth() (already emulator-bound by test/setup.ts) are used
// directly by test files for seeding/asserting — this file only covers the
// "wipe everything" operations those SDKs don't expose.

import * as admin from 'firebase-admin';

const EMULATOR_HOST = '127.0.0.1';
const FIRESTORE_PORT = 8080;
const AUTH_PORT = 9099;

function getProjectId(): string {
  return admin.app().options.projectId as string;
}

export async function clearFirestore(): Promise<void> {
  const projectId = getProjectId();
  await fetch(
    `http://${EMULATOR_HOST}:${FIRESTORE_PORT}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
}

export async function deleteAllAuthUsers(): Promise<void> {
  const projectId = getProjectId();
  await fetch(`http://${EMULATOR_HOST}:${AUTH_PORT}/emulator/v1/projects/${projectId}/accounts`, {
    method: 'DELETE',
  });
}
