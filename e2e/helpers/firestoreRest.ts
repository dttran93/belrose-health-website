// e2e/helpers/firestoreRest.ts
//
// Generic Firestore emulator REST helper — encodes a plain JS object into the emulator's
// documented `fields` wire format and PATCHes it in as a new document, same
// `Authorization: Bearer owner` admin bypass seedInvite.ts already uses for invites/{email}
// (there is no client-side `allow create` for these collections either — guestInvites,
// recordRequests, and users/{guestUid} are all meant to be written by Admin-SDK-privileged
// Cloud Functions in production).

const FIRESTORE_EMULATOR_HOST = 'localhost:8080';

type FirestoreValue = Record<string, unknown>;

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) } };
  }
  return { stringValue: String(value) };
}

function toFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFirestoreValue(v)]));
}

/** Writes `data` to `collection/{docId}` in the Firestore emulator, bypassing security rules. */
export async function seedFirestoreDoc(
  projectId: string,
  path: string,
  data: Record<string, unknown>
): Promise<void> {
  const url = `http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/${path}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });

  if (!res.ok) {
    throw new Error(`Failed to seed ${path}: ${res.status} ${await res.text()}`);
  }
}
