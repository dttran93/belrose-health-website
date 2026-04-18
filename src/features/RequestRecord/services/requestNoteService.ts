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
    // 1. Get master key from session
    const masterKey = await EncryptionKeyManager.getSessionKey();
    if (!masterKey)
      throw new Error('Encryption session not active. Please unlock your encryption.');

    // 2. Get current user
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated.');

    // 3. Fetch encrypted RSA private key from Firestore
    const db = getFirestore();
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) throw new Error('User profile not found.');

    const userData = userDoc.data();
    if (!userData.encryption?.encryptedPrivateKey) {
      throw new Error('Encryption keys not set up. Please complete account setup.');
    }

    console.log(
      'userData.encryption.publicKey (first 150):',
      userData.encryption?.publicKey?.slice(0, 150)
    );

    // 4. Decrypt RSA private key with master key
    const privateKeyBytes = await EncryptionService.decryptFile(
      base64ToArrayBuffer(userData.encryption.encryptedPrivateKey),
      masterKey,
      base64ToArrayBuffer(userData.encryption.encryptedPrivateKeyIV)
    );

    const rsaPrivateKey = await SharingKeyManagementService.importPrivateKey(
      arrayBufferToBase64(privateKeyBytes)
    );

    // 5. Unwrap the one-off AES note key using the RSA private key
    const aesKey = await SharingKeyManagementService.unwrapKey(encryptedNoteKey, rsaPrivateKey);

    // 6. AES-GCM decrypt the note ciphertext
    const decryptedBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToArrayBuffer(encryptedNoteIv) },
      aesKey,
      base64ToArrayBuffer(encryptedRequestNote)
    );

    // 7. Decode and parse back into RequestNote object
    return JSON.parse(new TextDecoder().decode(decryptedBytes)) as RequestNote;
  }
}
