// src/features/HealthProfile/services/userIdentityService.ts

import { getFirestore, doc, setDoc, Timestamp, getDoc } from 'firebase/firestore';
import { UserIdentity } from '../utils/parseUserIdentity';
import { removeUndefinedValues } from '@/utils/dataFormattingUtils';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { RecordHashService } from '@/features/ViewEditRecord/services/generateRecordHash';
import { isEncryptionEnabled } from '@/features/Encryption/encryptionConfig';
import { auth } from '@/firebase/config';
import { updateFirestoreRecord } from '@/firebase/uploadUtils';

/**
 * Converts a UserIdentity form object into a FHIR R4 Patient bundle.
 * This is the canonical FHIR representation of the identity record.
 */
export function buildIdentityFHIRBundle(identity: UserIdentity, userId: string): any {
  const patient: any = {
    resourceType: 'Patient',
    id: userId,
    name: identity.fullName ? [{ text: identity.fullName, use: 'official' }] : undefined,
    gender: identity.gender ?? undefined,
    birthDate: identity.dateOfBirth
      ? identity.dateOfBirth.toISOString().split('T')[0] // YYYY-MM-DD
      : undefined,
    address:
      identity.address || identity.city || identity.country
        ? [
            {
              text: identity.address ?? undefined,
              city: identity.city ?? undefined,
              country: identity.country ?? undefined,
            },
          ]
        : undefined,
    telecom: [
      identity.phone ? { system: 'phone', value: identity.phone } : null,
      identity.email ? { system: 'email', value: identity.email } : null,
    ].filter(Boolean),
    maritalStatus: identity.maritalStatus ? { text: identity.maritalStatus } : undefined,
    communication: identity.languages?.map(lang => ({
      language: { text: lang },
    })),
  };

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [{ resource: patient }],
  };
}

/**
 * Save (or overwrite) the user identity record with the deterministic ID.
 * Runs through encryption and hashing just like a normal record.
 */
export async function saveUserIdentityRecord(
  userId: string,
  identity: UserIdentity
): Promise<void> {
  const db = getFirestore();
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const recordId = `${userId}_u_id`;
  const fhirData = buildIdentityFHIRBundle(identity, userId);
  const fileName = 'User Identity';
  const belroseFields = {
    title: 'Belrose Health User Identity Document',
    visitType: 'Self-Reported',
    summary: `Identity record for ${identity.fullName ?? userId}. See fhirData for further details.`,
    completedDate: new Date().toISOString(),
    provider: 'Self-Reported',
    institution: 'Self-Reported',
    patient: identity.fullName ?? userId,
    detailedNarrative: `This is an identity record for ${identity.fullName ?? userId}. See fhirData for further details.`,
  };

  const existing = await getDoc(doc(db, 'records', recordId));

  if (existing.exists()) {
    // updateFirestoreRecord handles encryption, hashing, and versioning
    await updateFirestoreRecord(recordId, { fhirData, belroseFields, fileName });
    return;
  }

  // ── First save only ────────────────────────────────────────────────────────
  const recordHash = await RecordHashService.generateRecordHash({
    fileName,
    fhirData,
    extractedText: null,
    originalText: null,
  });

  let encryptedData: any = null;
  if (isEncryptionEnabled()) {
    const masterKey = await EncryptionKeyManager.getSessionKey();
    if (masterKey) {
      encryptedData = await EncryptionService.encryptCompleteRecord(
        fileName, // fileName
        undefined, // file (no actual file for virtual records)
        null, // extractedText
        null, // originalText
        null, // contextText
        fhirData, // fhirData
        belroseFields, // belroseFields
        null, // customData
        masterKey // userKey
      );
    }
  }
  try {
    await setDoc(
      doc(db, 'records', recordId),
      removeUndefinedValues({
        id: recordId,
        isEncrypted: !!encryptedData,
        fileName: encryptedData ? null : fileName,
        fileType: 'application/fhir+json',
        fileSize: JSON.stringify(fhirData).length,
        status: 'completed',
        isVirtual: true,
        recordType: 'user_identity', // filter key — keeps it out of clinical lists
        fhirData: encryptedData ? null : fhirData,
        belroseFields: encryptedData ? null : belroseFields,
        recordHash,
        aiProcessingStatus: 'not_needed',
        owners: [userId],
        administrators: [userId],
        subjects: [userId],
        uploadedBy: userId,
        lastModified: Timestamp.now(),
        createdAt: Timestamp.now(),
        encryptedFileName: encryptedData?.fileName ?? undefined,
        encryptedFhirData: encryptedData?.fhirData ?? undefined,
        encryptedBelroseFields: encryptedData?.belroseFields ?? undefined,
      })
    );
  } catch (e: any) {
    console.error('❌ Record write failed:', e.code, e.message);
    throw e;
  }

  if (encryptedData) {
    try {
      await setDoc(doc(db, 'wrappedKeys', `${recordId}_${userId}`), {
        recordId,
        userId,
        wrappedKey: encryptedData.encryptedKey,
        isCreator: true,
        createdAt: new Date(),
        isActive: true,
      });
    } catch (e: any) {
      console.error('❌ WrappedKey write failed:', e.code, e.message);
      throw e;
    }
  }
}
