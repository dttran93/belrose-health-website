// src/features/Sharing/services/sharingService.ts

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
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
import { SharingContractService } from '@/features/BlockchainVerification/service/sharingContractService';

export interface ShareRecordRequest {
  recordId: string;
  receiverWalletAddress?: string;
  receiverEmail?: string;
}

export interface SharedRecord {
  recordId: string;
  ownerId: string;
  receiverId: string;
  receiverWalletAddress: string;
  wrappedKeyId: string;
  permissionHash: string;
  isActive: boolean;
  grantedAt: Date;
  revokedAt?: Date;
}

export class SharingService {
  /**
   * Share a record with another user (family, provider, researcher, etc.)
   */
  static async shareRecord(request: ShareRecordRequest): Promise<void> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Validate that at least one identifier is provided
    if (!request.receiverEmail && !request.receiverWalletAddress) {
      throw new Error('Either receiver email or wallet address must be provided');
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

    // 2. Get receiver's information
    const getReceiver = async () => {
      const usersRef = collection(db, 'users');
      let q;

      if (request.receiverEmail) {
        q = query(usersRef, where('email', '==', request.receiverEmail));
      } else {
        q = query(usersRef, where('walletAddress', '==', request.receiverWalletAddress));
      }

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty || !querySnapshot.docs[0]) {
        throw new Error('Receiver not found');
      }

      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        data: doc.data(),
      };
    };

    const receiver = await getReceiver();
    const receiverId = receiver.id;
    const receiverData = receiver.data;

    if (!receiverData.publicKey) {
      throw new Error('Receiver has not set up encryption keys');
    }

    console.log('✅ Receiver found:', receiverId);

    // 3. Decrypt the record's AES key using owner's master key
    const encryptedKeyData = EncryptionService.base64ToArrayBuffer(recordData.encryptedKey);
    const recordKey = await EncryptionService.importKey(
      await EncryptionService.decryptKeyWithMasterKey(encryptedKeyData, masterKey)
    );

    console.log('✅ Record key decrypted');

    // 4. Wrap the record key with receiver's RSA public key
    const receiverPublicKey = await KeyManagementService.importPublicKey(receiverData.publicKey);
    const wrappedKeyForReceiver = await KeyManagementService.wrapKey(recordKey, receiverPublicKey);

    console.log('✅ Key wrapped for receiver');

    // 5. Create permission hash for blockchain
    const permissionData = {
      recordId: request.recordId,
      ownerAddress: user.uid,
      receiverAddress: receiverData.walletAddress,
      timestamp: Date.now(),
    };
    const permissionHash = ethers.id(JSON.stringify(permissionData));

    console.log('✅ Permission hash created:', permissionHash);

    // 6. Store wrapped key in Firestore
    const wrappedKeyId = `${request.recordId}_${receiverId}`;
    const wrappedKeyRef = doc(db, 'wrappedKeys', wrappedKeyId);

    await setDoc(wrappedKeyRef, {
      recordId: request.recordId,
      userId: receiverId,
      wrappedKey: wrappedKeyForReceiver,
      permissionHash: permissionHash,
      createdAt: new Date(),
      isActive: true,
    });

    console.log('✅ Wrapped key stored');

    // 7. Store access permission record
    const accessPermissionRef = doc(db, 'accessPermissions', permissionHash);

    await setDoc(accessPermissionRef, {
      recordId: request.recordId,
      ownerId: user.uid,
      receiverId: receiverId,
      receiverWalletAddress: receiverData.walletAddress,
      isActive: true,
      grantedAt: new Date(),
      revokedAt: null,
    });

    console.log('✅ Access permission stored');

    // 8. Store permission hash on blockchain
    try {
      console.log('🔗 Storing permission on blockchain...');
      const txHash = await SharingContractService.grantAccessOnChain(
        permissionHash,
        request.recordId,
        receiverData.walletAddress
      );
      console.log('✅ Blockchain transaction:', txHash);

      // Optionally store the transaction hash in Firestore
      await updateDoc(accessPermissionRef, {
        blockchainTxHash: txHash,
        onChain: true,
      });
    } catch (error) {
      console.error('❌ Blockchain transaction failed:', error);
      // Clean up Firestore if blockchain fails
      await deleteDoc(wrappedKeyRef);
      await deleteDoc(accessPermissionRef);
      throw new Error('Failed to store permission on blockchain: ' + (error as Error).message);
    }

    console.log('✅ Record shared successfully!');
  }

  /**
   * Revoke access to a record
   */
  static async revokeAccess(recordId: string, receiverId: string): Promise<void> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('🔄 Revoking access for record:', recordId);

    // 1. Get the wrapped key
    const wrappedKeyId = `${recordId}_${receiverId}`;
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

    // 4. Revoke permission on blockchain
    try {
      console.log('🔗 Revoking permission on blockchain...');
      const txHash = await SharingContractService.revokeAccessOnChain(
        wrappedKeyData.permissionHash
      );
      console.log('✅ Blockchain transaction:', txHash);

      // Optionally store the revocation tx hash
      await updateDoc(accessPermissionRef, {
        revocationTxHash: txHash,
      });
    } catch (error) {
      console.error('❌ Blockchain transaction failed:', error);
      throw new Error('Failed to revoke on blockchain: ' + (error as Error).message);
    }

    console.log('✅ Access revoked successfully!');
  }

  /**
   * Get all records shared by the current user (as owner)
   */
  static async getSharedRecords(): Promise<SharedRecord[]> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const accessPermissionsRef = collection(db, 'accessPermissions');
    const q = query(accessPermissionsRef, where('ownerId', '==', user.uid));

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        recordId: data.recordId,
        ownerId: data.ownerId,
        receiverId: data.receiverId,
        receiverWalletAddress: data.receiverWalletAddress,
        wrappedKeyId: `${data.recordId}_${data.receiverId}`,
        permissionHash: doc.id,
        isActive: data.isActive,
        grantedAt: data.grantedAt.toDate(),
        revokedAt: data.revokedAt?.toDate(),
      };
    });
  }

  /**
   * Get all records shared with the current user (as receiver)
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
      where('receiverId', '==', user.uid),
      where('isActive', '==', true)
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        recordId: data.recordId,
        ownerId: data.ownerId,
        receiverId: data.receiverId,
        receiverWalletAddress: data.receiverWalletAddress,
        wrappedKeyId: `${data.recordId}_${data.receiverId}`,
        permissionHash: doc.id,
        isActive: data.isActive,
        grantedAt: data.grantedAt.toDate(),
        revokedAt: data.revokedAt?.toDate(),
      };
    });
  }

  /**
   * Check if a receiver has access to a specific record
   */
  static async checkAccess(recordId: string, receiverId: string): Promise<boolean> {
    const db = getFirestore();

    const wrappedKeyId = `${recordId}_${receiverId}`;
    const wrappedKeyRef = doc(db, 'wrappedKeys', wrappedKeyId);
    const wrappedKeyDoc = await getDoc(wrappedKeyRef);

    if (!wrappedKeyDoc.exists()) {
      return false;
    }

    const data = wrappedKeyDoc.data();
    return data.isActive === true;
  }
}
