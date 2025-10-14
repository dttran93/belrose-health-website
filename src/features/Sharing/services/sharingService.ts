// src/features/Sharing/services/sharingService.ts

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { KeyManagementService } from './keyManagementService';
import { ethers } from 'ethers';

export interface ShareRecordRequest {
  recordId: string;
  providerWalletAddress?: string;
  providerEmail?: string; // Optional: to look up provider
}

export interface SharedRecord {
  recordId: string;
  patientId: string;
  providerId: string;
  providerWalletAddress: string;
  wrappedKeyId: string;
  permissionHash: string;
  isActive: boolean;
  grantedAt: Date;
  revokedAt?: Date;
}

export class SharingService {
  /**
   * Share a record with a healthcare provider
   */
  static async shareRecord(request: ShareRecordRequest): Promise<void> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    if (!request.providerEmail && !request.providerWalletAddress) {
      throw new Error('Either provider email or wallet address must be provided');
    }

    // Get the master key from session
    const masterKey = EncryptionKeyManager.getSessionKey();
    if (!masterKey) {
      throw new Error('Encryption session not active. Please unlock your encryption.');
    }

    console.log('🔄 Starting share process for record:', request.recordId);

    // 1. Get the record
    const recordRef = doc(db, 'records', request.recordId);
    const recordDoc = await getDoc(recordRef);

    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordDoc.data();

    // Verify the user owns this record
    if (recordData.patientId !== user.uid) {
      throw new Error('You do not own this record');
    }

    console.log('✅ Record found and ownership verified');

    // 2. Get provider's information
    const getProvider = async () => {
      const usersRef = collection(db, 'users');
      let q;

      if (request.providerEmail) {
        q = query(usersRef, where('email', '==', request.providerEmail));
      } else {
        q = query(usersRef, where('walletAddress', '==', request.providerWalletAddress));
      }

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty || !querySnapshot.docs[0]) {
        throw new Error('Provider not found');
      }

      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        data: doc.data(),
      };
    };

    const provider = await getProvider();
    const providerId = provider.id;
    const providerData = provider.data;

    if (!providerData.publicKey) {
      throw new Error('Provider has not set up encryption keys');
    }

    console.log('✅ Provider found:', providerId);

    // 3. Decrypt the record's AES key using patient's master key
    const encryptedKeyData = EncryptionService.base64ToArrayBuffer(recordData.encryptedKey);
    const recordKey = await EncryptionService.importKey(
      await EncryptionService.decryptKeyWithMasterKey(encryptedKeyData, masterKey)
    );

    console.log('✅ Record key decrypted');

    // 4. Wrap the record key with provider's RSA public key
    const providerPublicKey = await KeyManagementService.importPublicKey(providerData.publicKey);
    const wrappedKeyForProvider = await KeyManagementService.wrapKey(recordKey, providerPublicKey);

    console.log('✅ Key wrapped for provider');

    // 5. Create permission hash for blockchain
    const permissionData = {
      recordId: request.recordId,
      patientAddress: user.uid, // Or use wallet address if you prefer
      providerAddress: providerData.walletAddress,
      timestamp: Date.now(),
    };
    const permissionHash = ethers.id(JSON.stringify(permissionData));

    console.log('✅ Permission hash created:', permissionHash);

    // 6. Store wrapped key in Firestore
    const wrappedKeyId = `${request.recordId}_${providerId}`;
    const wrappedKeyRef = doc(db, 'wrappedKeys', wrappedKeyId);

    await setDoc(wrappedKeyRef, {
      recordId: request.recordId,
      userId: providerId,
      wrappedKey: wrappedKeyForProvider,
      permissionHash: permissionHash,
      createdAt: new Date(),
      isActive: true,
    });

    console.log('✅ Wrapped key stored');

    // 7. Store access permission record
    const accessPermissionRef = doc(db, 'accessPermissions', permissionHash);

    await setDoc(accessPermissionRef, {
      recordId: request.recordId,
      patientId: user.uid,
      providerId: providerId,
      providerWalletAddress: providerData.walletAddress,
      isActive: true,
      grantedAt: new Date(),
      revokedAt: null,
    });

    console.log('✅ Access permission stored');

    // 8. TODO: Store permission hash on blockchain
    // This will be done in the next step when we integrate with your smart contract
    // await this.storePermissionOnBlockchain(permissionHash, recordData.recordHash, providerData.walletAddress);

    console.log('✅ Record shared successfully!');
  }

  /**
   * Revoke access to a record
   */
  static async revokeAccess(recordId: string, providerId: string): Promise<void> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('🔄 Revoking access for record:', recordId);

    // 1. Get the wrapped key
    const wrappedKeyId = `${recordId}_${providerId}`;
    const wrappedKeyRef = doc(db, 'wrappedKeys', wrappedKeyId);
    const wrappedKeyDoc = await getDoc(wrappedKeyRef);

    if (!wrappedKeyDoc.exists()) {
      throw new Error('Access permission not found');
    }

    const wrappedKeyData = wrappedKeyDoc.data();

    // 2. Update wrapped key status
    await updateDoc(wrappedKeyRef, {
      isActive: false,
      revokedAt: new Date(),
    });

    console.log('✅ Wrapped key deactivated');

    // 3. Update access permission
    const accessPermissionRef = doc(db, 'accessPermissions', wrappedKeyData.permissionHash);

    await updateDoc(accessPermissionRef, {
      isActive: false,
      revokedAt: new Date(),
    });

    console.log('✅ Access permission revoked');

    // 4. TODO: Revoke permission on blockchain
    // await this.revokePermissionOnBlockchain(wrappedKeyData.permissionHash);

    console.log('✅ Access revoked successfully!');
  }

  /**
   * Get all records shared by the current user
   */
  static async getSharedRecords(): Promise<SharedRecord[]> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const accessPermissionsRef = collection(db, 'accessPermissions');
    const q = query(accessPermissionsRef, where('patientId', '==', user.uid));

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        recordId: data.recordId,
        patientId: data.patientId,
        providerId: data.providerId,
        providerWalletAddress: data.providerWalletAddress,
        wrappedKeyId: `${data.recordId}_${data.providerId}`,
        permissionHash: doc.id,
        isActive: data.isActive,
        grantedAt: data.grantedAt.toDate(),
        revokedAt: data.revokedAt?.toDate(),
      };
    });
  }

  /**
   * Get all records shared WITH the current user (as a provider)
   */
  static async getRecordsSharedWithMe(): Promise<SharedRecord[]> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const accessPermissionsRef = collection(db, 'accessPermissions');
    const q = query(
      accessPermissionsRef,
      where('providerId', '==', user.uid),
      where('isActive', '==', true)
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        recordId: data.recordId,
        patientId: data.patientId,
        providerId: data.providerId,
        providerWalletAddress: data.providerWalletAddress,
        wrappedKeyId: `${data.recordId}_${data.providerId}`,
        permissionHash: doc.id,
        isActive: data.isActive,
        grantedAt: data.grantedAt.toDate(),
        revokedAt: data.revokedAt?.toDate(),
      };
    });
  }

  /**
   * Check if a provider has access to a specific record
   */
  static async checkAccess(recordId: string, providerId: string): Promise<boolean> {
    const db = getFirestore();

    const wrappedKeyId = `${recordId}_${providerId}`;
    const wrappedKeyRef = doc(db, 'wrappedKeys', wrappedKeyId);
    const wrappedKeyDoc = await getDoc(wrappedKeyRef);

    if (!wrappedKeyDoc.exists()) {
      return false;
    }

    const data = wrappedKeyDoc.data();
    return data.isActive === true;
  }

  /**
   * Helper method to add to EncryptionService if not already there
   * This unwraps the master key encryption on record keys
   */
  private static async decryptKeyWithMasterKey(
    encryptedKeyData: ArrayBuffer,
    masterKey: CryptoKey
  ): Promise<ArrayBuffer> {
    const data = new Uint8Array(encryptedKeyData);
    const iv = data.slice(0, 12); // Assuming 12-byte IV for AES-GCM
    const encrypted = data.slice(12);

    return await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, encrypted);
  }
}
