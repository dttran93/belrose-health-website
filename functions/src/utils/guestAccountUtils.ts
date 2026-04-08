// functions/src/utils/guestAccountUtils.ts

/**
 * Shared utilities for creating guest accounts.
 *
 * Used by both:
 *   - createGuestInvite  (patient sharing records outward)
 *   - createRecordRequest (patient requesting records inward)
 *
 * Both flows create the same infrastructure: a Firebase Auth guest account,
 * an RSA key pair, a mock wallet, and a guestInvites doc. The only differences
 * are the email template and which Firestore collection tracks the business intent.
 */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { ethers } from 'ethers';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GuestAccountResult {
  guestUid: string;
  publicKeyBase64: string;
  privateKeyBase64: string;
  isNewGuest: boolean;
  guestIdHash: string;
  guestWallet: string;
}

export interface GuestInviteDocResult {
  inviteCode: string;
  expiresAt: Date;
}

export interface WriteGuestInviteParams {
  guestUid: string;
  invitedBy: string;
  guestEmail: string;
  recordIds: string[];
  guestIdHash: string;
  guestWallet: string;
  isNewGuest: boolean;
  durationSeconds?: number;
  // Optional context — helps distinguish invite type in Firestore if needed
  context?: 'sharing' | 'record_request';
  // For record_request context — link back to the recordRequests doc
  recordRequestId?: string;
}

// ── RSA key pair generation ───────────────────────────────────────────────────

/**
 * Generate an RSA-OAEP 2048-bit key pair using Node crypto.
 * Returns keys in base64-encoded SPKI (public) and PKCS8 (private) DER format —
 * the same format the frontend SharingKeyManagementService expects.
 */
export function generateRsaKeyPair(): {
  publicKeyBase64: string;
  privateKeyBase64: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  return {
    publicKeyBase64: (publicKey as Buffer).toString('base64'),
    privateKeyBase64: (privateKey as Buffer).toString('base64'),
  };
}

// ── Guest account creation ────────────────────────────────────────────────────

/**
 * Create or retrieve a guest Firebase Auth account for the given email.
 * Generates a fresh RSA key pair and writes/updates the user profile in Firestore.
 *
 * Keys are always regenerated on each call so each invite link has a fresh key.
 * If the provider later registers a real account, GuestClaimAccountModal
 * overwrites the key pair with a proper one derived from their password.
 */
export async function createOrRetrieveGuestAccount(email: string): Promise<GuestAccountResult> {
  const db = admin.firestore();

  // ── Create or reuse Firebase Auth account ──────────────────────────────────
  let guestUid: string;
  let isNewGuest = false;

  try {
    const existingUser = await admin.auth().getUserByEmail(email);
    guestUid = existingUser.uid;
    console.log(`ℹ️  Reusing existing guest account for ${email}: ${guestUid}`);
  } catch (err: any) {
    if (err.code !== 'auth/user-not-found') {
      throw new Error(`Failed to check for existing user: ${err.message}`);
    }
    isNewGuest = true;

    const newUser = await admin.auth().createUser({
      email,
      emailVerified: true, // clicking the link confirms the address is valid
      displayName: email,
    });
    guestUid = newUser.uid;
    console.log(`✅ Created guest Firebase Auth account: ${guestUid}`);
  }

  // ── Generate RSA key pair ──────────────────────────────────────────────────
  const { publicKeyBase64, privateKeyBase64 } = generateRsaKeyPair();

  // ── Derive deterministic on-chain identity from UID ───────────────────────
  const guestIdHash = ethers.keccak256(ethers.toUtf8Bytes(guestUid));
  const guestWallet = ethers.getAddress(
    '0x' + ethers.keccak256(ethers.toUtf8Bytes(`guest:${guestUid}`)).slice(-40)
  );

  // ── Write/update Firestore user profile ───────────────────────────────────
  // Minimal profile that SharingKeyManagementService needs —
  // specifically encryption.publicKey for wrapping file keys.
  const guestProfile = {
    uid: guestUid,
    email,
    displayName: email,
    emailVerified: true,
    isGuest: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(isNewGuest && { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
    encryption: {
      publicKey: publicKeyBase64,
    },
    onChainIdentity: {
      userIdHash: guestIdHash,
      status: 'Active',
      linkedWallets: [
        {
          address: guestWallet,
          type: 'eoa',
          txHash: '',
          blockNumber: 0,
          linkedAt: new Date(),
          isWalletActive: true,
        },
      ],
    },
  };

  await db.collection('users').doc(guestUid).set(guestProfile, { merge: true });
  console.log(`✅ Guest user profile written to Firestore: ${guestUid}`);

  return {
    guestUid,
    publicKeyBase64,
    privateKeyBase64,
    isNewGuest,
    guestIdHash,
    guestWallet,
  };
}

// ── Guest invite document ─────────────────────────────────────────────────────

/**
 * Write a guestInvites document.
 * Called by both createGuestInvite (sharing) and createRecordRequest (requesting).
 *
 * redeemGuestInvite reads from this collection to validate the code and
 * mint a custom token — so both flows get the same redemption mechanism.
 */
export async function writeGuestInviteDoc(
  params: WriteGuestInviteParams
): Promise<GuestInviteDocResult> {
  const db = admin.firestore();

  const durationSeconds = params.durationSeconds ?? 30 * 24 * 60 * 60; // 30 days default for requests
  const expiresAt = new Date(Date.now() + durationSeconds * 1000);
  const inviteCode = crypto.randomBytes(32).toString('hex');

  await db.collection('guestInvites').add({
    guestUserId: params.guestUid,
    invitedBy: params.invitedBy,
    guestEmail: params.guestEmail,
    recordIds: params.recordIds,
    status: 'pending',
    context: params.context ?? 'sharing',
    ...(params.recordRequestId && { recordRequestId: params.recordRequestId }),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    isNewGuest: params.isNewGuest,
    guestIdHash: params.guestIdHash,
    guestWallet: params.guestWallet,
    inviteCode,
  });

  console.log(`✅ guestInvites document created (context: ${params.context ?? 'sharing'})`);

  return { inviteCode, expiresAt };
}
