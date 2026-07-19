// e2e/helpers/testUser.ts
//
// Creates/reuses a fully-registered test user for e2e specs that need "an existing real
// account" rather than testing registration itself (that's signup.spec.ts's job). Drives the
// real registration UI once — real crypto generation + real on-chain registration — since
// EncryptionGate's unlock screen decrypts the master key with actual AES-GCM/PBKDF2 derived
// from the password; faking the Firestore encryption.* fields with placeholder values would
// make "log in and unlock" fail with a real decryption error. What this DOES skip is the
// /verification OOB-code UI dance (oobCode lookup + apply) — signup.spec.ts already covers
// that flow end-to-end, so this marks emailVerified directly on the Auth emulator instead.
//
// The Firestore/Auth emulators reset on every `emulators:exec` boot, so "reuse" mainly pays
// off within a single session (multiple tests in one file, or a persistent `emulators:start`
// session) — but the "check first" logic costs nothing extra otherwise.

import { expect, type Page } from '@playwright/test';
import { seedInvite, TEST_INVITE_CODE } from './seedInvite';

const AUTH_EMULATOR_HOST = 'localhost:9099';

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export const FIXTURE_GUARDIAN: TestUser = {
  email: 'e2e-fixture-guardian@example.com',
  password: 'Sup3rSecure!2026',
  firstName: 'E2E',
  lastName: 'Guardian',
};

async function findAuthUserByEmail(projectId: string, email: string): Promise<string | null> {
  const res = await fetch(`http://${AUTH_EMULATOR_HOST}/emulator/v1/projects/${projectId}/accounts`);
  if (!res.ok) {
    throw new Error(`Failed to list auth accounts: ${res.status} ${await res.text()}`);
  }
  const { userInfo } = (await res.json()) as { userInfo?: Array<{ localId: string; email?: string }> };
  return userInfo?.find(u => u.email === email)?.localId ?? null;
}

async function markEmailVerified(projectId: string, localId: string): Promise<void> {
  const res = await fetch(
    `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ localId, emailVerified: true }),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to mark email verified: ${res.status} ${await res.text()}`);
  }
}

/**
 * Ensures `user` is a fully-registered real account and is signed in on `page` when this
 * resolves (lands on /app). Registers fresh — real crypto + real on-chain registration — if the
 * account doesn't already exist in this emulator session; otherwise just signs in.
 */
export async function ensureTestUser(
  page: Page,
  projectId: string,
  user: TestUser = FIXTURE_GUARDIAN
): Promise<void> {
  const existingUid = await findAuthUserByEmail(projectId, user.email);

  if (existingUid) {
    await page.goto('/auth');
    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="password"]').fill(user.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/app/, { timeout: 15_000 });
    return;
  }

  await seedInvite(projectId, user.email);

  await page.goto('/auth/register');
  await page.getByLabel('Email address').fill(user.email);
  await page.getByRole('button', { name: 'Check my access' }).click();
  await page.getByLabel('Invite code').fill(TEST_INVITE_CODE);
  await page.getByRole('button', { name: 'Verify & continue' }).click();

  await page.locator('input[name="firstName"]').fill(user.firstName);
  await page.locator('input[name="lastName"]').fill(user.lastName);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.locator('input[name="confirmPassword"]').fill(user.password);
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Real wallet generation + on-chain registration (Base Sepolia) happens here.
  await expect(page.getByRole('heading', { name: 'Save Your Recovery Key' })).toBeVisible({
    timeout: 60_000,
  });
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Complete Registration' }).first().click();
  await page.getByRole('button', { name: 'Continue to Verification' }).click({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/verification/);

  // Skip the OOB-code UI dance — mark verified directly on the Auth emulator. The "I've
  // Verified My Email" button re-fetches the Auth user's emailVerified flag regardless of how
  // it was set server-side, so this is equivalent to the real applyOobCode path from the app's
  // point of view.
  const uid = await findAuthUserByEmail(projectId, user.email);
  if (!uid) {
    throw new Error(`Could not find newly-registered user ${user.email} in the Auth emulator`);
  }
  await markEmailVerified(projectId, uid);

  await page.getByRole('button', { name: "I've Verified My Email" }).click();
  await expect(page.getByRole('button', { name: 'Continue to App' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue to App' }).click();
  await expect(page).toHaveURL(/\/app/);
}
