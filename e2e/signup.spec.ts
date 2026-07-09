// e2e/signup.spec.ts
//
// Thin E2E smoke test — proves the Playwright + emulator harness works end-to-end before
// tackling anything permission-specific. Drives the real signup flow (real wallet
// generation + real on-chain registration via Base Sepolia/Pimlico, since that's baked
// into step 1 of registration itself — there's no way to sign up without it), verifies the
// email through the Auth emulator's OOB-code API instead of a real inbox, and confirms the
// user lands on the real protected app.

import { test, expect } from '@playwright/test';
import { getLatestOobCode, applyOobCode } from './helpers/authEmulator';
import { seedInvite, TEST_INVITE_CODE } from './helpers/seedInvite';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;

test('signs up, verifies email via the Auth emulator, and reaches /app', async ({ page }) => {
  if (!PROJECT_ID) {
    throw new Error(
      'VITE_FIREBASE_PROJECT_ID must be set in the environment (same value the app itself ' +
        'uses) so the Auth emulator REST helper targets the right project namespace.'
    );
  }

  const email = `e2e-${Date.now()}@example.com`;
  const password = 'Sup3rSecure!2026';

  await seedInvite(PROJECT_ID, email);

  await page.goto('/auth/register');

  // AlphaGateScreen gates every new registration behind an invite-code check.
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Check my access' }).click();
  await page.getByLabel('Invite code').fill(TEST_INVITE_CODE);
  await page.getByRole('button', { name: 'Verify & continue' }).click();

  await page.locator('input[name="firstName"]').fill('E2E');
  await page.locator('input[name="lastName"]').fill('Smoke');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Step 1 completing generates a wallet and registers it on-chain for real (Base Sepolia +
  // Pimlico) before advancing — give this real network round trip generous headroom.
  await expect(page.getByRole('heading', { name: 'Save Your Recovery Key' })).toBeVisible({
    timeout: 60_000,
  });

  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Complete Registration' }).first().click();

  await page
    .getByRole('button', { name: 'Continue to Verification' })
    .click({ timeout: 30_000 });

  await expect(page).toHaveURL(/\/verification/);

  const oobCode = await getLatestOobCode(PROJECT_ID, email, 'VERIFY_EMAIL');
  await applyOobCode(oobCode);

  await page.getByRole('button', { name: "I've Verified My Email" }).click();
  await expect(page.getByRole('button', { name: 'Continue to App' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue to App' }).click();

  await expect(page).toHaveURL(/\/app/);
});
