// e2e/helpers/seedInvite.ts
//
// Seeds an invites/{email} doc directly in the Firestore emulator so a freshly-generated
// test email can pass AlphaGateScreen (src/features/Auth/components/AlphaGateScreen.tsx)
// before the real signup flow can even be reached — the app gates all new registrations
// behind an invite-code check.
//
// firestore.rules has no `allow create` for invites/{email} at all (only `read: true` and a
// narrowly-scoped `update`) — those docs are meant to be created by an Admin-SDK-privileged
// process (an invite-sending Cloud Function), never the client SDK. So this writes via the
// Firestore emulator's REST API using its documented `Authorization: Bearer owner` token,
// which bypasses security rules entirely — an emulator-only escape hatch, meaningless
// against real Firestore.

const FIRESTORE_EMULATOR_HOST = 'localhost:8080';

// Exactly 16 alphanumeric chars — AlphaGateScreen's code input caps entry at 16 characters
// (.slice(0, 16)), so anything longer would be silently truncated in the UI and never match.
export const TEST_INVITE_CODE = 'E2ETESTINVITECOD';

export async function seedInvite(projectId: string, email: string): Promise<void> {
  const path = `invites/${encodeURIComponent(email.toLowerCase())}`;
  const url = `http://${FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/${path}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
    },
    body: JSON.stringify({
      fields: {
        approved: { booleanValue: true },
        code: { stringValue: TEST_INVITE_CODE },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to seed invites/${email}: ${res.status} ${await res.text()}`);
  }
}
