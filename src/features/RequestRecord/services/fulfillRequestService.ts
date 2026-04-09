// src/features/RecordRequest/services/fulfillRequestService.ts

/**
 * fulfillRequestService
 *
 * Handles the complete fulfillment flow when a provider uploads a record
 * in response to a patient's record request.
 *
 * Crypto flow (all in-browser, nothing sensitive leaves the device unencrypted):
 *   1. Generate a fresh AES-256 file key
 *   2. Encrypt the file bytes with that key
 *   3. Encrypt the file name with that key
 *   4. Import the requester's RSA public key (from the recordRequests doc)
 *   5. Wrap the AES key with the RSA public key
 *   6. Write encrypted record to Firestore + Storage
 *   7. Write wrappedKey doc so requester can decrypt via normal RSA path
 *   8. Mark the recordRequest as fulfilled
 *
 * The requester decrypts via the existing RecordDecryptionService RSA path
 * (isCreator: false branch).
 */

import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { SharingKeyManagementService } from '@/features/Sharing/services/sharingKeyManagementService';
import { arrayBufferToBase64, removeUndefinedValues } from '@/utils/dataFormattingUtils';

// src/features/RecordRequest/types.ts

import { Timestamp } from 'firebase/firestore';
import { FileObject } from '@/types/core';

// ── Firestore document ────────────────────────────────────────────────────────

export type RecordRequestStatus = 'pending' | 'fulfilled' | 'cancelled';

export interface RecordRequest {
  inviteCode: string;

  // Requester (the Belrose user who wants the records)
  requesterId: string;
  requesterEmail: string;
  requesterName: string;
  requesterPublicKey: string;

  // Target (the provider receiving the email)
  targetEmail: string;
  targetUserId: string | null;

  // Encrypted note — AES-256-GCM, key wrapped separately for each party
  encryptedRequestNote: string | null;
  encryptedNoteKeyForRequester: string | null;
  encryptedNoteKeyForProvider: string | null;
  encryptedNoteIv: string | null;

  // Lifecycle
  status: RecordRequestStatus;
  createdAt: Timestamp;
  readAt: Timestamp | null;
  deadline: Timestamp;
  fulfilledRecordId: string | null;
  fulfilledAt?: Timestamp;
  cancelledAt?: Timestamp;
}

// ── Service result types ──────────────────────────────────────────────────────

export interface FulfillRequestResult {
  success: boolean;
  recordId: string;
  fileKey: CryptoKey; // Return the file key so it can be rewrapped for the provider if needed
}

export class FulfillRequestService {
  // ============================================================================
  // MAIN FULFILL FLOW
  // ============================================================================

  /**
   * Encrypt a FileObject and write it to Firestore + Storage as a fulfilled
   * record request.
   *
   * @param recordRequest     - The full recordRequest document
   * @param fileObj           - Populated FileObject with plaintext fields ready
   * @param providerPublicKey - RSA public key of the provider if they are a
   *                           registered Belrose user. Pass undefined for
   *                           anonymous uploads (Path B/C).
   * @param providerUserId    - UID of the provider if authenticated. Required
   *                           when providerPublicKey is provided.
   */
  static async fulfill(
    recordRequest: RecordRequest,
    fileObj: FileObject,
    providerPublicKey?: string,
    providerUserId?: string
  ): Promise<FulfillRequestResult> {
    // ── Step 1: Ensure auth session ───────────────────────────────────────────
    // If the provider is a registered user they should already be signed in.
    // If anonymous, sign in now — gives us a UID for the audit trail without
    // requiring any account setup.
    const auth = getAuth();
    if (!auth.currentUser) {
      await signInAnonymously(auth);
      console.log('✅ Signed in anonymously for fulfill flow');
    }
    const uploaderUid = auth.currentUser!.uid;

    // ── Step 2: Encrypt complete record ───────────────────────────────────────
    // throwawayKey satisfies encryptCompleteRecord's userKey param (used to
    // produce result.encryptedKey via the creator/AES path). We discard
    // result.encryptedKey immediately — we use RSA wrapping instead.
    // result.fileKey is the actual AES key that encrypted all the fields.
    const throwawayKey = await EncryptionService.generateFileKey();

    const encrypted = await EncryptionService.encryptCompleteRecord(
      fileObj.fileName,
      fileObj.file,
      fileObj.extractedText ?? null,
      fileObj.originalText ?? null,
      fileObj.contextText ?? null,
      fileObj.fhirData ?? null,
      fileObj.belroseFields ?? null,
      fileObj.customData ?? null,
      throwawayKey
      // externalFileKey omitted — function generates internally and returns
      // it on result.fileKey so we can RSA-wrap it below
    );

    console.log('✅ Record encrypted');

    // ── Step 3: RSA-wrap file key for requester ───────────────────────────────
    const requesterRsaKey = await SharingKeyManagementService.importPublicKey(
      recordRequest.requesterPublicKey
    );
    const wrappedKeyForRequester = await SharingKeyManagementService.wrapKey(
      encrypted.fileKey,
      requesterRsaKey
    );
    console.log('✅ File key RSA-wrapped for requester');

    // ── Step 4: RSA-wrap file key for provider (Path A only) ─────────────────
    // If the provider is a registered Belrose user, wrap a second copy so
    // they get permanent access without needing the post-registration flow.
    let wrappedKeyForProvider: string | null = null;
    if (providerPublicKey && providerUserId) {
      const providerRsaKey = await SharingKeyManagementService.importPublicKey(providerPublicKey);
      wrappedKeyForProvider = await SharingKeyManagementService.wrapKey(
        encrypted.fileKey,
        providerRsaKey
      );
      console.log('✅ File key RSA-wrapped for authenticated provider');
    }

    // ── Step 5: Pre-generate Firestore record ID ──────────────────────────────
    // Needed before Storage upload so the path follows records/{recordId}/...
    const db = getFirestore();
    const recordRef = doc(collection(db, 'records'));
    const recordId = recordRef.id;

    // ── Step 6: Upload encrypted file to Storage ──────────────────────────────
    // Skipped for virtual/text-only records.
    let downloadURL: string | null = null;
    let storagePath: string | null = null;

    if (encrypted.file && fileObj.file) {
      const storage = getStorage();
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      storagePath = `records/${recordId}/${uniqueId}.encrypted`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(
        storageRef,
        new Blob([encrypted.file.encrypted], { type: 'application/octet-stream' }),
        {
          contentType: 'application/octet-stream',
          customMetadata: {
            uploadedBy: uploaderUid,
            encrypted: 'true',
            uploadedAt: new Date().toISOString(),
            recordId,
            fulfillRequestId: recordRequest.inviteCode,
          },
        }
      );

      downloadURL = await getDownloadURL(storageRef);
      console.log('✅ Encrypted file uploaded to Storage');
    }

    // ── Step 7: Write Firestore record document ───────────────────────────────
    // Shape mirrors createFirestoreRecord in uploadUtils.ts exactly.
    const documentData = removeUndefinedValues({
      fileSize: fileObj.fileSize,
      fileType: fileObj.fileType,
      downloadURL,
      storagePath,

      // Ownership — requester owns it, anonymous provider UID is audit trail only
      uploadedBy: uploaderUid,
      owners: [recordRequest.requesterId],
      // If provider is registered, include them as administrator from the start
      administrators: providerUserId
        ? [recordRequest.requesterId, providerUserId]
        : [recordRequest.requesterId],
      viewers: [],
      subjects: [],

      isEncrypted: true,
      isVirtual: fileObj.isVirtual ?? false,
      encryptedFileIV: encrypted.file?.iv ?? undefined,

      encryptedFileName: encrypted.fileName
        ? { encrypted: encrypted.fileName.encrypted, iv: encrypted.fileName.iv }
        : undefined,
      encryptedExtractedText: encrypted.extractedText
        ? { encrypted: encrypted.extractedText.encrypted, iv: encrypted.extractedText.iv }
        : undefined,
      encryptedOriginalText: encrypted.originalText
        ? { encrypted: encrypted.originalText.encrypted, iv: encrypted.originalText.iv }
        : undefined,
      encryptedContextText: encrypted.contextText
        ? { encrypted: encrypted.contextText.encrypted, iv: encrypted.contextText.iv }
        : undefined,
      encryptedFhirData: encrypted.fhirData
        ? { encrypted: encrypted.fhirData.encrypted, iv: encrypted.fhirData.iv }
        : undefined,
      encryptedBelroseFields: encrypted.belroseFields
        ? { encrypted: encrypted.belroseFields.encrypted, iv: encrypted.belroseFields.iv }
        : undefined,
      encryptedCustomData: encrypted.customData
        ? { encrypted: encrypted.customData.encrypted, iv: encrypted.customData.iv }
        : undefined,

      sourceType: fileObj.sourceType ?? 'File Upload',
      wordCount: fileObj.wordCount ?? undefined,
      aiProcessingStatus: fileObj.aiProcessingStatus ?? 'not_needed',
      recordHash: fileObj.recordHash ?? null,
      originalFileHash: fileObj.originalFileHash ?? null,
      versionNumber: 0,
      fulfilledFromRequest: recordRequest.inviteCode,

      uploadedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastModified: serverTimestamp(),
      status: 'completed',
    });

    await setDoc(recordRef, documentData);
    console.log('✅ Firestore record document created:', recordId);

    // ── Step 8: Write wrappedKey for requester ────────────────────────────────
    await setDoc(doc(db, 'wrappedKeys', `${recordId}_${recordRequest.requesterId}`), {
      recordId,
      userId: recordRequest.requesterId,
      wrappedKey: wrappedKeyForRequester,
      isActive: true,
      isCreator: false, // → RecordDecryptionService uses RSA unwrap path
      grantedBy: null,
      createdAt: serverTimestamp(),
    });
    console.log('✅ wrappedKeys document created for requester');

    // ── Step 9: Write wrappedKey for provider if Path A ──────────────────────
    if (wrappedKeyForProvider && providerUserId) {
      await setDoc(doc(db, 'wrappedKeys', `${recordId}_${providerUserId}`), {
        recordId,
        userId: providerUserId,
        wrappedKey: wrappedKeyForProvider,
        isActive: true,
        isCreator: false,
        grantedBy: null,
        createdAt: serverTimestamp(),
      });
      console.log('✅ wrappedKeys document created for provider');
    }

    // ── Step 10: Mark request fulfilled ──────────────────────────────────────
    await updateDoc(doc(db, 'recordRequests', recordRequest.inviteCode), {
      status: 'fulfilled',
      fulfilledRecordId: recordId,
      fulfilledAt: serverTimestamp(),
    });
    console.log('✅ recordRequest marked fulfilled');

    // Return the fileKey alongside the result so the page can hold it in
    // state for the post-registration wrap (Path B). The key lives in memory
    // only — it is gone permanently if the page unmounts or the user navigates.
    return { success: true, recordId, fileKey: encrypted.fileKey };
  }

  // ============================================================================
  // POST-REGISTRATION WRAP (Path B)
  // ============================================================================

  /**
   * Called after a successful upload (Path B) if the provider chooses to
   * register an account on the success screen.
   *
   * The page holds the fileKey returned by fulfill() in component state.
   * Once registration completes and the provider's public key is saved to
   * Firestore, the page calls this method to write their wrappedKeys entry.
   *
   * This window closes the moment the page unmounts — the key cannot be
   * recovered after that point.
   *
   * @param recordId          - The record created by fulfill()
   * @param fileKey           - The AES file key from FulfillRequestResult
   * @param providerUserId    - UID of the newly registered provider
   * @param providerPublicKey - RSA public key from their fresh user profile
   */
  static async wrapAndSaveForProvider(
    recordId: string,
    fileKey: CryptoKey,
    providerUserId: string,
    providerPublicKey: string
  ): Promise<void> {
    const db = getFirestore();

    const rsaKey = await SharingKeyManagementService.importPublicKey(providerPublicKey);
    const wrappedKey = await SharingKeyManagementService.wrapKey(fileKey, rsaKey);

    await setDoc(doc(db, 'wrappedKeys', `${recordId}_${providerUserId}`), {
      recordId,
      userId: providerUserId,
      wrappedKey,
      isActive: true,
      isCreator: false,
      grantedBy: null,
      createdAt: serverTimestamp(),
    });

    // Also add them as administrator on the record so they can actually access it
    const { updateDoc: update, doc: docRef } = await import('firebase/firestore');
    await update(docRef(db, 'records', recordId), {
      administrators: (await import('firebase/firestore')).arrayUnion(providerUserId),
    });

    console.log('✅ Post-registration wrap complete for provider:', providerUserId);
  }
}
