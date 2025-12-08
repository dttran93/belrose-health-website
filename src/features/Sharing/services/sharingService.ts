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
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { SharingKeyManagementService } from './sharingKeyManagementService';
import { ethers } from 'ethers';
import { SharingBlockchainService } from '@/features/Sharing/services/sharingBlockchainService';
import { EmailInvitationService } from './emailInvitationService';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { BlockchainRoleManagerService } from '@/features/Permissions/services/blockchainRoleManagerService';

export interface ShareRecordRequest {
  recordId: string;
  receiverWalletAddress?: string;
  receiverEmail?: string;
}

export interface AccessPermissionData {
  recordId: string;
  sharerId: string;
  sharerWalletAddress: string;
  receiverId: string;
  receiverWalletAddress: string;
  wrappedKeyId: string;
  permissionHash: string;
  isActive: boolean;
  grantedAt: Date;
  revokedAt?: Date;
  blockchainTxHash: string;
  onChain: boolean;
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
    // These are user-facing identifiers. We'll look up the receiver's uid in Firestore
    // uid will be used for internal operations
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
    if (!recordData.administrators || !recordData.administrators.includes(user.uid)) {
      throw new Error('You are neither an administrator nor owner of this record');
    }

    console.log('✅ Record found and ownership verified');

    const getReceiver = async () => {
      const usersRef = collection(db, 'users');
      let q;

      console.log('🔍 Looking up receiver with:', {
        email: request.receiverEmail,
        wallet: request.receiverWalletAddress,
      });

      if (request.receiverEmail) {
        q = query(usersRef, where('email', '==', request.receiverEmail));
      } else {
        q = query(usersRef, where('walletAddress', '==', request.receiverWalletAddress));
      }

      console.log('🔍 Executing query...');
      const querySnapshot = await getDocs(q);
      console.log('✅ Query completed. Results:', querySnapshot.size);

      // ✅ CASE 1: Receiver doesn't exist at all
      if (querySnapshot.empty || !querySnapshot.docs[0]) {
        if (request.receiverEmail) {
          // Send signup invitation
          console.log('📧 Receiver not found. Sending signup invitation...');

          try {
            const result = await EmailInvitationService.sendShareInvitation({
              senderName: user.displayName || user.email || 'A Belrose user',
              senderEmail: user.email || '',
              receiverEmail: request.receiverEmail,
              recordName: recordData.fileName || 'a health record',
            });

            throw new Error(
              `We sent an invitation to ${request.receiverEmail}! They'll need to create a Belrose account and verify their email before you can share with them.`
            );
          } catch (inviteError) {
            // If invitation sending fails, still throw a helpful error
            throw new Error(
              'Receiver not found. They need a Belrose account to receive shared records. Please ask them to sign up at belrosehealth.com'
            );
          }
        } else {
          throw new Error(
            'Receiver not found. They need a Belrose account to receive shared records.'
          );
        }
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      // ✅ CASE 2: Email not verified
      if (request.receiverEmail && data.emailVerified === false) {
        console.log('📧 Email not verified. Sending verification reminder...');

        try {
          const result = await EmailInvitationService.sendShareInvitation({
            senderName: user.displayName || user.email || 'A Belrose user',
            senderEmail: user.email || '',
            receiverEmail: request.receiverEmail,
            recordName: recordData.fileName || 'a health record',
          });

          throw new Error(
            `We sent a reminder to ${request.receiverEmail}! They'll need to verify their email before you can share with them. We've asked them to check their inbox.`
          );
        } catch (inviteError) {
          throw new Error(
            `${request.receiverEmail} hasn't verified their email yet. We tried to send them a reminder, but you may want to contact them directly.`
          );
        }
      }

      // ✅ CASE 3: Email verification status unknown (for safety)
      if (request.receiverEmail && data.emailVerified === undefined) {
        console.warn('⚠️ Email verification status unknown for user');
        throw new Error(
          `Unable to confirm if ${request.receiverEmail} has verified their email. Please ask them to verify and try again.`
        );
      }

      // ✅ CASE 4: No encryption keys set up
      if (!data.encryption?.publicKey) {
        throw new Error(
          'Receiver has not completed their account setup (encryption keys missing). Please ask them to complete their registration.'
        );
      }

      // ✅ ALL CHECKS PASSED!
      return {
        id: doc.id,
        data: data,
      };
    };

    const receiver = await getReceiver();
    const receiverId = receiver.id;
    const receiverData = receiver.data;

    if (!receiverData.encryption?.publicKey) {
      throw new Error('Receiver has not set up encryption keys');
    }

    console.log('✅ Receiver found:', receiverId);

    //Check if they already have access
    console.log('📝 About to check for existing wrapped key...');
    const wrappedKeyId = `${request.recordId}_${receiverId}`;
    const existingWrappedKeyRef = doc(db, 'wrappedKeys', wrappedKeyId);
    const existingWrappedKey = await getDoc(existingWrappedKeyRef);
    console.log('✅ Existing wrapped key check complete');

    if (existingWrappedKey.exists()) {
      const existingData = existingWrappedKey.data();

      // Check if it's active
      if (existingData.isActive) {
        // Check if they're an admin
        const isAdmin = recordData.administrators?.includes(receiverId);
        const role = isAdmin ? 'administrator' : 'viewer';

        throw new Error(`This user already has ${role} priviledges. No need to share again.`);
      } else {
        // They had access before but it was revoked - we can re-share
        console.log('ℹ️  User previously had access (now revoked), re-sharing...');
      }
    }

    console.log('🔍 Checking record data:', {
      hasEncryptedKey: !!recordData.encryptedKey,
      encryptedKeyType: typeof recordData.encryptedKey,
      encryptedKeyPreview: recordData.encryptedKey?.substring?.(0, 100),
    });

    // 3. Decrypt the record's AES key using owner's master key
    const recordKey = await RecordDecryptionService.getRecordKey(request.recordId, masterKey);

    console.log('✅ Record key decrypted');

    console.log('🔍 Checking receiver public key:', {
      hasPublicKey: !!receiverData.encryption.publicKey,
      publicKeyType: typeof receiverData.encryption.publicKey,
      publicKeyPreview: receiverData.encryption.publicKey?.substring?.(0, 100),
    });

    // 4. Wrap the record key with receiver's RSA public key
    console.log('📝 About to import receiver public key...');
    const receiverPublicKey = await SharingKeyManagementService.importPublicKey(
      receiverData.encryption.publicKey
    );
    console.log('✅ Receiver public key imported');

    console.log('📝 About to wrap key for receiver...');
    const wrappedKeyForReceiver = await SharingKeyManagementService.wrapKey(
      recordKey,
      receiverPublicKey
    );

    console.log('✅ Key wrapped for receiver');

    // 5. Create permission hash for blockchain
    // 5.1: Get sharer's wallet address:
    console.log('📝 About to get sharer wallet address...');
    const sharerRef = doc(db, 'users', user.uid);
    const sharerDoc = await getDoc(sharerRef);
    console.log('✅ Sharer doc retrieved');

    if (!sharerDoc.exists()) {
      throw new Error('User profile not found');
    }

    const sharerData = sharerDoc.data();
    const sharerWalletAddress = sharerData.wallet?.address || '';

    if (!sharerWalletAddress) {
      throw new Error('User wallet address not found. Please connect or generate a wallet.');
    }

    //5.2 get receiver wallet address
    const receiverWalletAddress = receiverData.wallet?.address || '';

    if (!receiverWalletAddress) {
      throw new Error(
        'Receiver wallet address not found. They need to connect or generate a wallet.'
      );
    }

    // 5.3 create permission hash using Ethereum's Keccak-256 (ethers.id())
    const permissionData = {
      recordId: request.recordId,
      sharerAddress: sharerWalletAddress,
      receiverAddress: receiverWalletAddress,
      timestamp: Date.now(),
    };
    const permissionHash = ethers.id(JSON.stringify(permissionData));

    console.log('✅ Permission hash created:', permissionHash);
    console.log('✅ Permission data (off-chain):', permissionData);

    // 6. Store permission hash on blockchain
    let txHash;
    try {
      console.log('🔗 Storing permission on blockchain...');
      txHash = await SharingBlockchainService.grantAccessOnChain(
        permissionHash,
        request.recordId,
        receiverWalletAddress
      );
      console.log('✅ Blockchain transaction:', txHash);
    } catch (error) {
      console.error('❌ Blockchain transaction failed:', error);
      throw new Error(
        'Failed to store permission on blockchain, canceling share: ' + (error as Error).message
      );
    }

    // 6.5 Grant viewer role on MemberRoleManager
    try {
      console.log('🔗 Granting viewer role on blockchain...');
      await BlockchainRoleManagerService.grantRole(
        request.recordId,
        receiverWalletAddress,
        'viewer'
      );
      console.log('✅ Blockchain: Viewer role granted');
    } catch (blockchainError) {
      console.error('⚠️ Failed to grant viewer role on blockchain:', blockchainError);
      // Log to sync queue for retry - don't fail the share since access permission succeeded
      await this.logBlockchainSyncFailure(
        request.recordId,
        'grantRole',
        { walletAddress: receiverWalletAddress, role: 'viewer', userId: receiverId },
        blockchainError as Error
      );
    }

    // 7. Store everything in Firestore
    // 7.1 create reference in Firestore
    const wrappedKeyRef = doc(db, 'wrappedKeys', wrappedKeyId);
    const accessPermissionRef = doc(db, 'accessPermissions', permissionHash);

    //7.2 function to actually write stuff to firestore
    const writeToFirestore = async () => {
      await setDoc(wrappedKeyRef, {
        recordId: request.recordId,
        userId: receiverId,
        wrappedKey: wrappedKeyForReceiver,
        permissionHash: permissionHash,
        createdAt: new Date(),
        isActive: true,
      });

      await setDoc(accessPermissionRef, {
        recordId: request.recordId,
        sharerId: user.uid,
        sharerWalletAddress: sharerWalletAddress,
        receiverId: receiverId,
        receiverWalletAddress: receiverWalletAddress,
        isActive: true,
        grantedAt: new Date(),
        revokedAt: null,
        blockchainTxHash: txHash,
        onChain: true,
      });
    };

    //7.3 Handle Firestore write failures with retry queue
    //If firestore fails after blockchain succeeds, save to pending queue for background sync
    try {
      await writeToFirestore();
      console.log('✅ Wrapped key stored', {
        wrappedKeyId,
        recordId: request.recordId,
        receiverId: receiverId,
        currentUser: user.uid,
      });
      console.log('✅ Record shared successfully!:', {
        permissionHash,
        recordId: request.recordId,
        sharerId: user.uid,
        receiverId,
      });
    } catch (error) {
      console.error('❌ Firestore write failed:', error);

      // Save to pending queue for background processing
      try {
        await setDoc(doc(db, 'pendingPermissions', permissionHash), {
          txHash,
          permissionHash,
          recordId: request.recordId,
          receiverId,
          wrappedKey: wrappedKeyForReceiver,
          receiverWalletAddress,
          createdAt: new Date(),
        });

        //Manual TO-DO: Someone needs to process pendingPermissions queue and retry write to wrappedKey/accessPermissions

        throw new Error(
          'Permission saved on blockchain (tx: ' +
            txHash +
            ') but local save failed. ' +
            'Your permission is valid and will sync shortly.'
        );
      } catch (queueError) {
        throw new Error(
          'Permission saved on blockchain (tx: ' +
            txHash +
            ') but local save failed. ' +
            'Please contact support with this transaction hash.'
        );
      }
    }
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

    // 4. Revoke permission on Access Permissions smart contract
    try {
      console.log('🔗 Revoking permission on blockchain...');
      const txHash = await SharingBlockchainService.revokeAccessOnChain(
        wrappedKeyData.permissionHash
      );
      console.log('✅ Blockchain transaction:', txHash);

      // Store revocation Tx Hash for audit trail
      await updateDoc(accessPermissionRef, {
        revocationTxHash: txHash,
      });
    } catch (error) {
      console.error('❌ Blockchain transaction failed:', error);
      throw new Error('Failed to revoke on blockchain: ' + (error as Error).message);
    }

    // 5. Revoke role on MemberRoleManager Smart Contract
    const receiverDoc = await getDoc(doc(db, 'users', receiverId));
    const receiverData = receiverDoc.data();
    const receiverWalletAddress = receiverData?.wallet?.address;

    if (receiverWalletAddress) {
      try {
        console.log('🔗 Revoking role on blockchain...');
        await BlockchainRoleManagerService.revokeRole(recordId, receiverWalletAddress);
        console.log('✅ Blockchain: Role revoked');
      } catch (blockchainError) {
        console.error('⚠️ Failed to revoke role on blockchain:', blockchainError);
        await this.logBlockchainSyncFailure(
          recordId,
          'revokeRole',
          { walletAddress: receiverWalletAddress, userId: receiverId },
          blockchainError as Error
        );
      }
    } else {
      console.warn('⚠️ No wallet address found for receiver, skipping blockchain revoke');
    }

    console.log('✅ Access revoked successfully!');
  }

  /**
   * Get all records shared by the current user (as owner)
   */
  static async getSharedRecords(): Promise<AccessPermissionData[]> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const accessPermissionsRef = collection(db, 'accessPermissions');
    const q = query(accessPermissionsRef, where('sharerId', '==', user.uid));

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        recordId: data.recordId,
        sharerId: data.sharerId,
        sharerWalletAddress: data.sharerWalletAddress,
        receiverId: data.receiverId,
        receiverWalletAddress: data.receiverWalletAddress,
        wrappedKeyId: `${data.recordId}_${data.receiverId}`,
        permissionHash: doc.id,
        isActive: data.isActive,
        grantedAt: data.grantedAt.toDate(),
        revokedAt: data.revokedAt?.toDate(),
        blockchainTxHash: data.blockchainTxHash,
        onChain: data.onChain,
      };
    });
  }

  /**
   * Get all records shared with the current user (as receiver)
   */
  static async getRecordsSharedWithMe(): Promise<AccessPermissionData[]> {
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
        sharerId: data.sharerId,
        sharerWalletAddress: data.sharerWalletAddress,
        receiverId: data.receiverId,
        receiverWalletAddress: data.receiverWalletAddress,
        wrappedKeyId: `${data.recordId}_${data.receiverId}`,
        permissionHash: doc.id,
        isActive: data.isActive,
        grantedAt: data.grantedAt.toDate(),
        revokedAt: data.revokedAt?.toDate(),
        blockchainTxHash: data.blockchainTxHash,
        onChain: data.onChain,
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

  // Add this helper method to the class
  private static async logBlockchainSyncFailure(
    recordId: string,
    action: 'grantRole' | 'changeRole' | 'revokeRole',
    params: {
      walletAddress: string;
      role?: 'owner' | 'administrator' | 'viewer';
      userId: string;
    },
    error: Error
  ): Promise<void> {
    try {
      const db = getFirestore();
      await addDoc(collection(db, 'blockchainSyncQueue'), {
        recordId,
        action,
        walletAddress: params.walletAddress,
        role: params.role || null,
        userId: params.userId,
        error: error.message,
        status: 'pending',
        retryCount: 0,
        createdAt: serverTimestamp(),
        lastAttemptAt: serverTimestamp(),
      });
      console.log('📝 Blockchain sync failure logged for retry');
    } catch (logError) {
      console.error('❌ Failed to log blockchain sync failure:', logError);
    }
  }
}
