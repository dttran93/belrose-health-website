// src/features/Dependents/services/dependentAccountService.ts
// Client-side orchestration for dependent account creation.
// All private key material is generated here and only the encrypted form is ever
// sent to the server — consistent with the E2EE model used in registration and
// guest account claiming.

import { getFunctions, httpsCallable } from 'firebase/functions';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { SharingKeyManagementService } from '@/features/Sharing/services/sharingKeyManagementService';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { WalletGenerationService } from '@/features/Auth/services/walletGenerationService';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';

export interface CreateDependentAccountParams {
  firstName: string;
  lastName: string;
  email: string; // real email or placeholder
  password: string; // guardian sets this on behalf of the dependent
}

export interface CreateDependentAccountResult {
  uid: string;
  walletAddress: string;
  smartAccountAddress: string;
  recoveryKey: string; // 24-word mnemonic — shown to guardian once, never stored
}

export function generatePlaceholderEmail(): string {
  const randomId = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  return `dep-${randomId}@placeholder.belrose.health`;
}

export class DependentAccountService {
  static async createAccount(
    params: CreateDependentAccountParams
  ): Promise<CreateDependentAccountResult> {
    const { firstName, lastName, email, password } = params;

    // ── Client-side crypto generation ─────────────────────────────────────────
    // All key material is generated here. Only encrypted forms leave the client.

    console.log('🔐 Generating encryption keys for dependent...');

    const masterKey = await EncryptionKeyManager.generateMasterKey();

    const { encryptedKey, iv, salt } = await EncryptionKeyManager.wrapMasterKeyWithPassword(
      masterKey,
      password
    );

    const recoveryKey = await EncryptionKeyManager.generateRecoveryKeyFromMasterKey(masterKey);
    const recoveryKeyHash = await EncryptionKeyManager.hashRecoveryKey(recoveryKey);

    const { publicKey, privateKey } = await SharingKeyManagementService.generateUserKeyPair();

    const privateKeyBytes = base64ToArrayBuffer(privateKey);
    const { encrypted: encryptedPrivateKeyBuffer, iv: privateKeyIV } =
      await EncryptionService.encryptFile(privateKeyBytes, masterKey);

    const masterKeyHex = await WalletGenerationService.convertMasterKeyToHex(masterKey);

    console.log('✅ Crypto material generated');

    // ── Call Cloud Function with encrypted material only ──────────────────────
    const functions = getFunctions();
    const createFn = httpsCallable<
      Record<string, string>,
      { uid: string; walletAddress: string; smartAccountAddress: string }
    >(functions, 'createDependentAccount');

    const result = await createFn({
      email,
      password,
      firstName,
      lastName,
      encryptedMasterKey: encryptedKey,
      masterKeyIV: iv,
      masterKeySalt: salt,
      publicKey,
      encryptedPrivateKey: arrayBufferToBase64(encryptedPrivateKeyBuffer),
      encryptedPrivateKeyIV: arrayBufferToBase64(privateKeyIV),
      recoveryKeyHash,
      masterKeyHex,
    });

    return {
      uid: result.data.uid,
      walletAddress: result.data.walletAddress,
      smartAccountAddress: result.data.smartAccountAddress,
      recoveryKey,
    };
  }
}
