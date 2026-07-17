// e2e/dependents.spec.ts
//
// Guardian creates a dependent through the real UI (real wallet generation + real on-chain
// registration, same as signup.spec.ts — this happens twice here: once for the guardian's own
// registration, once for the dependent), switches into the dependent's session via
// AccountSwitcherModal, then switches back to the guardian. Confirms the account-identity
// boundary switches correctly (sidebar reflects the active account) on both hops.
//
// The deeper guarantee that EncryptionKeyManager.clearSession() actually fires at the right
// point relative to signInWithCustomToken (so no key material bleeds across the switch
// boundary) is unit-tested directly in accountSwitchService.test.ts — this spec proves the
// user-visible consequence of that (switching accounts requires re-entering that account's own
// password to unlock, and shows that account's own identity), not the internals.

import { test, expect, type Page } from '@playwright/test';
import { getLatestOobCode, applyOobCode } from './helpers/authEmulator';
import { seedInvite, TEST_INVITE_CODE } from './helpers/seedInvite';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;

async function registerGuardian(page: Page, email: string, password: string): Promise<void> {
  if (!PROJECT_ID) {
    throw new Error('VITE_FIREBASE_PROJECT_ID must be set in the environment.');
  }

  await seedInvite(PROJECT_ID, email);

  await page.goto('/auth/register');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Check my access' }).click();
  await page.getByLabel('Invite code').fill(TEST_INVITE_CODE);
  await page.getByRole('button', { name: 'Verify & continue' }).click();

  await page.locator('input[name="firstName"]').fill('E2E');
  await page.locator('input[name="lastName"]').fill('Guardian');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Real wallet generation + on-chain registration (Base Sepolia) happens here.
  await expect(page.getByRole('heading', { name: 'Save Your Recovery Key' })).toBeVisible({
    timeout: 60_000,
  });
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Complete Registration' }).first().click();
  await page.getByRole('button', { name: 'Continue to Verification' }).click({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/verification/);

  const oobCode = await getLatestOobCode(PROJECT_ID, email, 'VERIFY_EMAIL');
  await applyOobCode(oobCode);

  await page.getByRole('button', { name: "I've Verified My Email" }).click();
  await expect(page.getByRole('button', { name: 'Continue to App' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue to App' }).click();
  await expect(page).toHaveURL(/\/app/);
}

/** Opens the bottom-left account menu and clicks "Switch Account". */
async function openAccountSwitcher(page: Page): Promise<void> {
  // The button showing the active account's name/avatar is the only one in the sidebar whose
  // accessible name is driven by the current user's own displayName — no stable test id exists
  // on it, so this locates it by the ArrowLeftRight-adjacent "Switch Account" menu item instead:
  // click whichever button currently shows a ChevronUp/name combo to open the dropdown first.
  await page.locator('button:has(svg.lucide-chevron-up)').first().click();
  await page.getByRole('button', { name: 'Switch Account' }).click();
}

test('guardian creates a dependent, switches into it, and switches back', async ({ page }) => {
  test.setTimeout(180_000);

  const guardianEmail = `e2e-guardian-${Date.now()}@example.com`;
  const guardianPassword = 'Sup3rSecure!2026';
  const dependentPassword = 'DepSecure!2026Pw';

  await registerGuardian(page, guardianEmail, guardianPassword);

  // ── Create the dependent ──────────────────────────────────────────────────
  await page.goto('/app/dependents/create');

  await page.locator('input[placeholder="Jane"]').fill('Little');
  await page.locator('input[placeholder="Smith"]').fill('Dependent');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.locator('input[placeholder="At least 8 characters"]').fill(dependentPassword);
  await page.locator('input[placeholder="Repeat the password"]').fill(dependentPassword);
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Real wallet generation + on-chain registration happens here too (createDependentAccount CF).
  await expect(page.getByText(/Save Little's recovery key/)).toBeVisible({ timeout: 60_000 });
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Complete Registration' }).click();

  await expect(page.getByRole('heading', { name: 'Account Created' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Dependents' }).click();
  await expect(page).toHaveURL(/\/app\/settings\/dependents/);
  await expect(page.getByText('Little Dependent')).toBeVisible();

  // ── Switch into the dependent's account ───────────────────────────────────
  await openAccountSwitcher(page);
  await expect(page.getByText('Managed accounts')).toBeVisible();
  await page.getByText('Little Dependent').click();

  // Switching clears the encryption session — the dependent's own password unlocks it fresh.
  await expect(page.getByText('Unlock Account')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Password').fill(dependentPassword);
  await page.getByRole('button', { name: 'Unlock' }).click();

  // Now operating as the dependent: sidebar reflects the switched identity.
  await expect(page.getByText('Dependent account')).toBeVisible({ timeout: 15_000 });

  // ── Switch back to the guardian ───────────────────────────────────────────
  await openAccountSwitcher(page);
  await expect(page.getByText('Switch to')).toBeVisible();
  await page.getByText('E2E Guardian').click();

  await expect(page.getByText('Unlock Account')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Password').fill(guardianPassword);
  await page.getByRole('button', { name: 'Unlock' }).click();

  // Back to the guardian: the dependent-only label is gone again.
  await expect(page.getByText('Dependent account')).not.toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(guardianEmail)).toBeVisible();
});
