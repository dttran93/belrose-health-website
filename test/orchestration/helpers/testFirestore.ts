// test/orchestration/helpers/testFirestore.ts
//
// Connects the REAL firebase/firestore client SDK (the same one PermissionsService uses
// internally via getFirestore()) to the dedicated orchestration emulator — see
// firebase.orchestration.json / test/orchestration/permissive.rules. PermissionsService
// calls getFirestore() with no app argument, which resolves to whichever app was most
// recently initializeApp()'d — so connectTestFirestore() must run before any test calls
// into PermissionsService.
//
// Each test FILE must pass its own unique projectId. Vitest runs test files in parallel by
// default, and the Firestore emulator can host many independent projects at once (the same
// trick test/rules uses, one projectId per file) — sharing one projectId across files means
// one file's beforeEach-clear can wipe data another file's in-flight test just seeded.

import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, type Firestore } from 'firebase/firestore';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8090;

let db: Firestore | undefined;
let connectedProjectId: string | undefined;

export function connectTestFirestore(projectId: string): Firestore {
  if (db) return db;

  // Clear out any app left behind by a previous file in the same worker.
  getApps().forEach(app => deleteApp(app));

  const app = initializeApp({ projectId });
  db = getFirestore(app);
  connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORT);
  connectedProjectId = projectId;
  return db;
}

export async function clearTestFirestore(): Promise<void> {
  await fetch(
    `http://${EMULATOR_HOST}:${EMULATOR_PORT}/emulator/v1/projects/${connectedProjectId}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
}

/** Seeds a users/{uid} doc with the wallet address PermissionsService.getUserWalletAddress reads. */
export async function seedUser(testDb: Firestore, uid: string, walletAddress: string): Promise<void> {
  await setDoc(doc(testDb, 'users', uid), { wallet: { address: walletAddress } });
}

type RecordRoleArrays = {
  owners?: string[];
  administrators?: string[];
  sharers?: string[];
  viewers?: string[];
  subjects?: string[];
};

export async function seedRecord(
  testDb: Firestore,
  recordId: string,
  roles: RecordRoleArrays
): Promise<void> {
  await setDoc(doc(testDb, 'records', recordId), {
    owners: roles.owners ?? [],
    administrators: roles.administrators ?? [],
    sharers: roles.sharers ?? [],
    viewers: roles.viewers ?? [],
    subjects: roles.subjects ?? [],
  });
}
