// e2e/helpers/authEmulator.ts
//
// Talks directly to the Firebase Auth emulator's REST API to read and apply the
// out-of-band (OOB) code for a pending email-verification request — this is the emulator's
// stand-in for "the user clicked the link in their real inbox," so the E2E suite doesn't
// need a real mailbox.

const AUTH_EMULATOR_HOST = 'localhost:9099';

interface OobCodeRecord {
  email: string;
  requestType: 'EMAIL_SIGNIN' | 'VERIFY_EMAIL' | 'PASSWORD_RESET' | string;
  oobCode: string;
}

export async function getLatestOobCode(
  projectId: string,
  email: string,
  requestType: OobCodeRecord['requestType']
): Promise<string> {
  const res = await fetch(`http://${AUTH_EMULATOR_HOST}/emulator/v1/projects/${projectId}/oobCodes`);
  if (!res.ok) {
    throw new Error(`Failed to list oob codes: ${res.status} ${await res.text()}`);
  }

  const { oobCodes } = (await res.json()) as { oobCodes: OobCodeRecord[] };
  const matches = oobCodes.filter(c => c.email === email && c.requestType === requestType);
  const latest = matches[matches.length - 1];

  if (!latest) {
    throw new Error(`No pending ${requestType} oob code found for ${email}`);
  }

  return latest.oobCode;
}

export async function applyOobCode(oobCode: string): Promise<void> {
  // The emulator accepts any non-empty string as the API key query param.
  const res = await fetch(
    `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:update?key=e2e-test`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oobCode }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to apply oob code: ${res.status} ${await res.text()}`);
  }
}
