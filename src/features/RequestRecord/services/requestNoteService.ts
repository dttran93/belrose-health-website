// src/features/RecordRequest/services/requestNoteService.ts

/**
 * Service for decrypting request notes either as a requester or provider.
 * Provider decrypts from the RSA key in the url or the user's Belrose profile if they're already registered
 */

import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { SharingKeyManagementService } from '@/features/Sharing/services/sharingKeyManagementService';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { RequestNote } from '../components/Request/NewRequestForm';
import { RecordRequest } from '@belrose/shared';

// ── Service ───────────────────────────────────────────────────────────────────

export class RequestNoteService {
  /**
   * Decrypt the request note as the requester (patient).
   * Uses encryptedNoteKeyForRequester.
   */
  static async decryptAsRequester(request: RecordRequest): Promise<RequestNote | null> {
    if (
      !request.encryptedRequestNote ||
      !request.encryptedNoteKeyForRequester ||
      !request.encryptedNoteIv
    )
      return null;

    return RequestNoteService.decrypt(
      request.encryptedRequestNote,
      request.encryptedNoteKeyForRequester,
      request.encryptedNoteIv
    );
  }

  /**
   * Decrypt the request note as the provider (doctor).
   * Uses encryptedNoteKeyForProvider.
   */
  static async decryptAsProvider(request: RecordRequest): Promise<RequestNote | null> {
    if (
      !request.encryptedRequestNote ||
      !request.encryptedNoteKeyForProvider ||
      !request.encryptedNoteIv
    )
      return null;

    return RequestNoteService.decrypt(
      request.encryptedRequestNote,
      request.encryptedNoteKeyForProvider,
      request.encryptedNoteIv
    );
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  /**
   * Shared decryption implementation.
   * Retrieves the current user's RSA private key from Firestore, unwraps the
   * AES note key, then AES-GCM decrypts the note ciphertext.
   */
  private static async decrypt(
    encryptedRequestNote: string,
    encryptedNoteKey: string,
    encryptedNoteIv: string
  ): Promise<RequestNote> {
    const masterKey = await EncryptionKeyManager.getSessionKey();
    if (!masterKey) throw new Error('Encryption session not active.');

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated.');

    const rsaPrivateKey = EncryptionKeyManager.hasGuestRsaPrivateKey()
      ? await RequestNoteService.getGuestRsaPrivateKey()
      : await RequestNoteService.getRegisteredUserRsaPrivateKey(user.uid, masterKey);

    const aesKey = await SharingKeyManagementService.unwrapKey(encryptedNoteKey, rsaPrivateKey);

    const decryptedBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToArrayBuffer(encryptedNoteIv) },
      aesKey,
      base64ToArrayBuffer(encryptedRequestNote)
    );

    return JSON.parse(new TextDecoder().decode(decryptedBytes)) as RequestNote;
  }

  /**
   * Get RSA private key for guest users — reads the ephemeral key
   * delivered via the invite URL and stored in memory by FulfillRequestPage.
   */
  private static async getGuestRsaPrivateKey(): Promise<CryptoKey> {
    const guestPrivateKeyBase64 = EncryptionKeyManager.getGuestRsaPrivateKey();
    if (!guestPrivateKeyBase64) {
      throw new Error('Guest RSA key not found in memory. Please click the invite link again.');
    }
    console.log('ℹ️ Decrypting note as guest — using ephemeral RSA key');
    return SharingKeyManagementService.importPrivateKey(guestPrivateKeyBase64);
  }

  /**
   * Get RSA private key for registered users — fetches the encrypted private
   * key from Firestore and decrypts it with the user's master key.
   */
  private static async getRegisteredUserRsaPrivateKey(
    userId: string,
    masterKey: CryptoKey
  ): Promise<CryptoKey> {
    const db = getFirestore();
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) throw new Error('User profile not found.');

    const userData = userDoc.data();
    if (!userData.encryption?.encryptedPrivateKey) {
      throw new Error('Encryption keys not set up. Please complete account setup.');
    }

    const privateKeyBytes = await EncryptionService.decryptFile(
      base64ToArrayBuffer(userData.encryption.encryptedPrivateKey),
      masterKey,
      base64ToArrayBuffer(userData.encryption.encryptedPrivateKeyIV)
    );

    return SharingKeyManagementService.importPrivateKey(arrayBufferToBase64(privateKeyBytes));
  }
}
