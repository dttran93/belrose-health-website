// src/features/Dependents/services/dependentAccountService.ts
// Client-side orchestration for the dependent account lifecycle: creation, handoff
// initiation, and claiming. All private key material for creation is generated here
// and only the encrypted form is ever sent to the server — consistent with the E2EE
// model used in registration and guest account claiming.

import { getFunctions, httpsCallable } from 'firebase/functions';
import { WalletGenerationService } from '@/features/Auth/services/walletGenerationService';
import { AccountEncryptionService } from '@/features/Auth/services/accountEncryptionService';

export interface CreateDependentAccountParams {
  firstName: string;
  lastName: string;
  email: string; // real email or placeholder
  password: string; // guardian sets this on behalf of the dependent
  onProgress?: (phase: 'keys' | 'registering') => void;
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
    const { firstName, lastName, email, password, onProgress } = params;

    // ── Client-side crypto generation ─────────────────────────────────────────
    // All key material is generated here. Only encrypted forms leave the client.

    onProgress?.('keys');
    console.log('🔐 Generating encryption keys for dependent...');

    const bundle = await AccountEncryptionService.generateEncryptionBundle(password);

    // No client-side wallet/on-chain registration here — the dependent has no
    // active session/signer. Only the hex conversion happens client-side; the
    // Cloud Function generates and registers the wallet server-side using the
    // admin wallet.
    const masterKeyHex = await WalletGenerationService.convertMasterKeyToHex(bundle.masterKey);

    console.log('✅ Crypto material generated');
    onProgress?.('registering');

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
      encryptedMasterKey: bundle.encryptedMasterKey,
      masterKeyIV: bundle.masterKeyIV,
      masterKeySalt: bundle.masterKeySalt,
      publicKey: bundle.publicKey,
      encryptedPrivateKey: bundle.encryptedPrivateKey,
      encryptedPrivateKeyIV: bundle.encryptedPrivateKeyIV,
      recoveryKeyHash: bundle.recoveryKeyHash,
      masterKeyHex,
    });

    return {
      uid: result.data.uid,
      walletAddress: result.data.walletAddress,
      smartAccountAddress: result.data.smartAccountAddress,
      recoveryKey: bundle.recoveryKey,
    };
  }

  static async initiateHandoff(dependentUid: string, contactEmail: string): Promise<void> {
    const fn = httpsCallable(getFunctions(), 'initiateHandoff');
    await fn({ dependentUid, contactEmail });
  }

  static async claimAccount(): Promise<void> {
    const fn = httpsCallable<Record<string, never>, { success: boolean }>(
      getFunctions(),
      'claimDependentAccount'
    );
    await fn({});
  }
}
