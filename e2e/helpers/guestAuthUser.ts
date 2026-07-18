// e2e/helpers/guestAuthUser.ts
//
// Creates a Firebase Auth user with a caller-chosen uid directly via the Auth emulator's
// Admin-scoped REST surface — the same `Authorization: Bearer owner` privileged path
// firebase-admin's `auth().createUser({ uid, ... })` itself goes through when pointed at the
// emulator. Real guest accounts are created this way too (createOrRetrieveGuestAccount calls
// admin.auth().createUser server-side) — this just lets e2e tests seed that same end state
// without needing a real invite email round trip.

const AUTH_EMULATOR_HOST = 'localhost:9099';

export async function createGuestAuthUser(
  projectId: string,
  uid: string,
  email: string
): Promise<void> {
  const res = await fetch(
    `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: uid, email, emailVerified: true, displayName: email }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to create guest auth user ${uid}: ${res.status} ${await res.text()}`);
  }
}
