// e2e/requestFlowGuestClaim.spec.ts
//
// A guest provider (record_request context) claims their temporary account into a real one:
// real wallet generation + real on-chain registration (Base Sepolia), same as signup.spec.ts/
// dependents.spec.ts, plus the guest-specific guestPasswordUpdate Cloud Function call.
//
// Getting a guest session into the browser realistically requires either a shared record
// (needs the OCR/FHIR record-upload pipeline) or driving the real provider-search-driven
// NewRequestForm (needs external NHS/ICB directory data and never exposes the guest's private
// key to any test-reachable API — it's only ever emailed). Neither is what this spec is
// actually testing. Instead, this seeds the two Firestore docs createRecordRequest.ts would
// have written (recordRequests + guestInvites) plus the guest Firebase Auth user
// createOrRetrieveGuestAccount.ts would have created, directly via the emulators' admin REST
// APIs — the same `Authorization: Bearer owner` bypass seedInvite.ts already uses. From that
// point on, every step (landing on /fulfill-request, redeemGuestInvite, signInWithCustomToken,
// GuestClaimAccountModal's full atomic-batch + wallet-registration + guestPasswordUpdate flow)
// runs for real, through the real UI.
//
// guestContext="record_request" specifically avoids needing any pre-existing wrappedKeys/shared
// record: handleCredentialsSubmit's hasGuestFileKeys() guard and handleClaim's Step 1a rewrap
// are both gated on `guestContext !== 'record_request'`, so this flow is exercised without a
// real record ever existing — that's the shared-file-key rewrap path, not this one.

import { test, expect } from '@playwright/test';
import { createGuestAuthUser } from './helpers/guestAuthUser';
import { seedFirestoreDoc } from './helpers/firestoreRest';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;

test('guest provider claims their account via the record-request fulfill flow', async ({
  page,
}) => {
  test.setTimeout(240_000);

  if (!PROJECT_ID) {
    throw new Error('VITE_FIREBASE_PROJECT_ID must be set in the environment.');
  }

  const stamp = Date.now();
  const guestUid = `e2e-guest-${stamp}`;
  const guestEmail = `e2e-guest-${stamp}@example.com`;
  const requestId = `e2e-request-${stamp}`;
  const guestInviteCode = `e2e-guestcode-${stamp}`;
  const claimPassword = 'GuestSecure!2026Pw';

  // ── Seed the guest account + invite/request docs a real createRecordRequest call would leave ──
  await createGuestAuthUser(PROJECT_ID, guestUid, guestEmail);

  await seedFirestoreDoc(PROJECT_ID, `users/${guestUid}`, {
    uid: guestUid,
    email: guestEmail,
    displayName: guestEmail,
    emailVerified: true,
    isGuest: true,
    encryption: { publicKey: 'e2e-fake-guest-public-key' },
  });

  await seedFirestoreDoc(PROJECT_ID, `recordRequests/${requestId}`, {
    inviteCode: requestId,
    requesterId: 'e2e-requester-uid',
    requesterEmail: 'requester@example.com',
    requesterName: 'E2E Requester',
    requesterPublicKey: 'e2e-fake-requester-public-key',
    targetEmail: guestEmail,
    targetUserId: null,
    providerGuestUid: guestUid,
    providerPublicKey: 'e2e-fake-guest-public-key',
    status: 'pending',
    createdAt: new Date(),
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    fulfilledRecordIds: null,
  });

  await seedFirestoreDoc(PROJECT_ID, `guestInvites/e2e-invite-${stamp}`, {
    guestUserId: guestUid,
    invitedBy: 'e2e-requester-uid',
    guestEmail,
    recordIds: [],
    status: 'pending',
    context: 'record_request',
    recordRequestId: requestId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000),
    isNewGuest: true,
    inviteCode: guestInviteCode,
  });

  // ── Land on the fulfill-request page (no private-key hash — Step 1b's note rewrap is
  // best-effort and never reached here since this recordRequests doc has no encrypted note) ──
  await page.goto(`/fulfill-request?code=${requestId}&guestCode=${guestInviteCode}`);

  // loadRequest() awaits checkEmailRegistrationStatus before rendering anything — a real CF
  // round trip, so this needs the same generous headroom as the on-chain steps below rather
  // than a short UI-interaction timeout.
  await expect(
    page.getByRole('heading', { name: 'E2E Requester is requesting their health records' })
  ).toBeVisible({ timeout: 60_000 });

  // ── Redeem the invite + sign in as the guest (real redeemGuestInvite CF call) ──
  await page.getByRole('button', { name: 'Create a free account & upload' }).click();

  // ── GuestClaimAccountModal opens directly (FulfillRequestPage hardcodes guestContext) ──
  await expect(page.getByRole('heading', { name: 'Create Your Account' })).toBeVisible({
    timeout: 60_000,
  });

  await page.locator('input[placeholder="Jane"]').fill('E2E');
  await page.locator('input[placeholder="Smith"]').fill('Provider');
  await page.locator('input[placeholder="At least 8 characters"]').fill(claimPassword);
  await page.locator('input[placeholder="Repeat your password"]').fill(claimPassword);
  await page.getByRole('button', { name: 'Continue →' }).click();

  // ── Real wallet generation + on-chain registration (Base Sepolia) + guestPasswordUpdate CF ──
  await expect(page.getByRole('heading', { name: 'Save Your Recovery Key' })).toBeVisible({
    timeout: 60_000,
  });
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Complete Registration' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome to Belrose!' })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: 'Get Started' }).click();

  // ── Claimed: FulfillRequestPage's onComplete navigates to /app/record-requests, and the
  // guest banner is gone since isGuest flipped to false and AuthContext refreshed ──
  await expect(page).toHaveURL(/\/app\/record-requests/);
  await expect(page.getByText(/temporary guest/)).not.toBeVisible();
});
