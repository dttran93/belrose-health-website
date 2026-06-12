// functions/src/handlers/createDependentAccount.ts
// Creates a dependent account on behalf of a guardian.
// Client generates all crypto material; this CF handles the identity operations
// that require Admin SDK: Firebase Auth user creation, Firestore writes to another
// user's document, blockchain registration with the admin wallet, and the active
// trustee relationship (which Firestore rules require to start as 'pending' from
// the client — bypassed here because the guardian is the one giving consent).

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { ethers } from 'ethers';
import { MEMBER_ROLE_MANAGER, NETWORK } from '../_shared/';
import { encryptPrivateKey, generateWallet } from '../services/backendWalletService';
import { computeSmartAccountAddress } from './wallet';

interface CreateDependentAccountRequest {
  email: string; // real email or placeholder (dep-{id}@placeholder.belrose.health)
  password: string;
  firstName: string;
  lastName: string;

  // Pre-generated encrypted crypto material (all generated client-side before this call)
  encryptedMasterKey: string;
  masterKeyIV: string;
  masterKeySalt: string;
  publicKey: string;
  encryptedPrivateKey: string;
  encryptedPrivateKeyIV: string;
  recoveryKeyHash: string;
  masterKeyHex: string; // used server-side only to encrypt the blockchain wallet private key
}

interface CreateDependentAccountResult {
  uid: string;
  walletAddress: string;
  smartAccountAddress: string;
}

const MEMBER_ROLE_MANAGER_ADDRESS = MEMBER_ROLE_MANAGER.proxy;
const CHAIN_ID = NETWORK.chainId;

const MEMBER_ROLE_MANAGER_ABI = [
  'function addMemberBatch(address[] calldata walletAddresses, bytes32 userIdHash) external',
  'function bootstrapDependentTrustee(bytes32 trustorIdHash, bytes32 trusteeIdHash) external',
];

function getAdminWallet(): ethers.Wallet {
  const privateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL || NETWORK.rpcUrlFallback;
  if (!privateKey) throw new Error('Admin wallet private key not found');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Wallet(privateKey, provider);
}

export const createDependentAccount = onCall(
  { secrets: ['ADMIN_WALLET_PRIVATE_KEY', 'RPC_URL'] },
  async (request): Promise<CreateDependentAccountResult> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Guardian must be authenticated');

    const guardianUid = request.auth.uid;
    const db = getFirestore();

    // Dependents cannot create other dependents
    const guardianDoc = await db.collection('users').doc(guardianUid).get();
    if (!guardianDoc.exists) throw new HttpsError('not-found', 'Guardian profile not found');
    if (guardianDoc.data()?.isDependent) {
      throw new HttpsError('permission-denied', 'Dependent accounts cannot create other accounts');
    }

    const {
      email,
      password,
      firstName,
      lastName,
      encryptedMasterKey,
      masterKeyIV,
      masterKeySalt,
      publicKey,
      encryptedPrivateKey,
      encryptedPrivateKeyIV,
      recoveryKeyHash,
      masterKeyHex,
    } = request.data as CreateDependentAccountRequest;

    if (
      !email || !password || !firstName || !lastName ||
      !encryptedMasterKey || !masterKeyIV || !masterKeySalt ||
      !publicKey || !encryptedPrivateKey || !encryptedPrivateKeyIV ||
      !recoveryKeyHash || !masterKeyHex
    ) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    // ── Step 1: Create Firebase Auth user ─────────────────────────────────────
    const isPlaceholder = email.endsWith('@placeholder.belrose.health');
    let dependentUid: string;
    try {
      const displayName = `${firstName} ${lastName}`.trim();
      const authUser = await admin.auth().createUser({ email, password, displayName, emailVerified: isPlaceholder });
      dependentUid = authUser.uid;
      console.log('✅ Firebase Auth user created:', dependentUid);
    } catch (err: any) {
      if (err.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'An account with this email already exists');
      }
      console.error('❌ Firebase Auth user creation failed:', err);
      throw new HttpsError('internal', 'Failed to create account');
    }

    const dependentRef = db.collection('users').doc(dependentUid);
    const now = Timestamp.now();

    try {
      // ── Step 2: Create Firestore user document ─────────────────────────────
      const displayName = `${firstName} ${lastName}`.trim();
      await dependentRef.set({
        uid: dependentUid,
        email,
        emailVerified: isPlaceholder,
        displayName,
        displayNameLower: displayName.toLowerCase(),
        firstName,
        lastName,
        isDependent: true,
        dependentCreatedBy: guardianUid,
        identityVerified: false,
        createdAt: now,
        updatedAt: now,
        encryption: {
          enabled: true,
          encryptedMasterKey,
          masterKeyIV,
          masterKeySalt,
          encryptedPrivateKey,
          encryptedPrivateKeyIV,
          publicKey,
          recoveryKeyHash,
          setupAt: now.toDate().toISOString(),
        },
      });
      console.log('✅ Firestore user document created');

      // ── Step 3: Wallet generation + on-chain registration ──────────────────
      // Mirrors registerMemberOnChainComplete but uses dependentUid rather than
      // request.auth.uid (guardian is the caller; dependent has no active session).
      console.log('🔐 Generating EOA wallet...');
      const wallet = generateWallet();

      console.log('🧮 Computing smart account address...');
      const smartAccountAddress = await computeSmartAccountAddress(wallet.privateKey);

      console.log('⛓️ Registering both wallets on-chain...');
      const userIdHash = ethers.id(dependentUid);
      const contract = new ethers.Contract(MEMBER_ROLE_MANAGER_ADDRESS, MEMBER_ROLE_MANAGER_ABI, getAdminWallet());
      const tx = await contract.addMemberBatch([wallet.address, smartAccountAddress], userIdHash);
      const receipt = await tx.wait();
      const blockchainRef = {
        txHash: tx.hash,
        chainId: CHAIN_ID,
        blockNumber: receipt.blockNumber,
        contractAddress: MEMBER_ROLE_MANAGER_ADDRESS,
      };
      console.log('✅ Both wallets registered on-chain:', tx.hash);

      // Bootstrap on-chain trustee relationship.
      // Dependent accounts have no independent signer at creation time, so the normal
      // propose → accept two-wallet flow is not possible. The admin wallet writes the
      // Active + Controller relationship directly in the same admin batch as addMemberBatch.
      // Revocation uses the normal onlyActiveMember flow — no admin involvement after this.
      const guardianIdHash = ethers.id(guardianUid);
      const trusteeTx = await contract.bootstrapDependentTrustee(userIdHash, guardianIdHash);
      const trusteeReceipt = await trusteeTx.wait();
      const trusteeBlockchainRef = {
        txHash: trusteeTx.hash,
        chainId: CHAIN_ID,
        blockNumber: trusteeReceipt.blockNumber,
        contractAddress: MEMBER_ROLE_MANAGER_ADDRESS,
      };
      console.log('✅ On-chain trustee relationship bootstrapped:', trusteeTx.hash);

      const encryptedWallet = encryptPrivateKey(wallet.privateKey, masterKeyHex);
      const encryptedMnemonic = encryptPrivateKey(wallet.mnemonic || '', masterKeyHex);

      await dependentRef.update({
        wallet: {
          address: wallet.address.toLowerCase(),
          smartAccountAddress: smartAccountAddress.toLowerCase(),
          origin: 'generated',
          encryptedPrivateKey: encryptedWallet.encryptedKey,
          encryptedPrivateKeyIV: encryptedWallet.iv,
          keyAuthTag: encryptedWallet.authTag,
          keySalt: encryptedWallet.salt,
          encryptedMnemonic: encryptedMnemonic.encryptedKey,
          mnemonicIv: encryptedMnemonic.iv,
          mnemonicAuthTag: encryptedMnemonic.authTag,
          mnemonicSalt: encryptedMnemonic.salt,
        },
        onChainIdentity: {
          userIdHash,
          status: 'Active',
          linkedWallets: [
            { address: wallet.address.toLowerCase(), type: 'eoa', isWalletActive: true, registeredAt: now, blockchainRef },
            { address: smartAccountAddress.toLowerCase(), type: 'smartAccount', isWalletActive: true, registeredAt: now, blockchainRef },
          ],
          registeredAt: now,
          blockchainRef,
        },
      });
      console.log('✅ Wallet data saved to Firestore');

      // ── Step 4: Active controller trustee relationship ─────────────────────
      // trustorId = dependent (account owner), trusteeId = guardian (account manager).
      // Written via Admin SDK to bypass the client Firestore rule that requires
      // new relationships to start as status:'pending' / isActive:false.
      const relationshipId = `${dependentUid}_${guardianUid}`;
      await db.collection('trusteeRelationships').doc(relationshipId).set({
        trustorId: dependentUid,
        trusteeId: guardianUid,
        trustLevel: 'controller',
        isActive: true,
        status: 'active',
        isDependentRelationship: true,
        createdAt: now,
        respondedAt: now,
        revokedAt: null,
        revokedBy: null,
        statusUpdateReason: null,
        inviteBlockchainRef: trusteeBlockchainRef,
        acceptBlockchainRef: trusteeBlockchainRef,
        revocationBlockchainRef: null,
        editBlockchainRef: null,
      });
      console.log('✅ Controller trustee relationship created');

      return { uid: dependentUid, walletAddress: wallet.address, smartAccountAddress };
    } catch (err) {
      // Best-effort cleanup: remove the Auth user so we don't leave orphaned accounts
      console.error('❌ Dependent account setup failed, cleaning up Auth user:', err);
      try {
        await admin.auth().deleteUser(dependentUid);
      } catch (cleanupErr) {
        console.error('❌ Cleanup failed — Auth user may be orphaned:', cleanupErr);
      }
      throw new HttpsError('internal', 'Failed to set up dependent account');
    }
  }
);
