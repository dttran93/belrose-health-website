// src/features/Dependents/services/accountSwitchService.ts
// Handles the client-side account switching flow.
// The CF generates a custom token for the target UID; we then sign in with it.
// onAuthStateChanged fires automatically, causing useAuth to re-fetch the
// new profile — no manual state updates needed across the app.

import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';

export const AccountSwitchService = {
  async switchToDependent(dependentUid: string): Promise<void> {
    const functions = getFunctions();
    const fn = httpsCallable<{ dependentUid: string }, { token: string }>(
      functions,
      'switchToDependent'
    );
    const result = await fn({ dependentUid });
    await signInWithCustomToken(getAuth(), result.data.token);
    EncryptionKeyManager.clearSession();
  },

  async switchToGuardian(guardianUid: string): Promise<void> {
    const functions = getFunctions();
    const fn = httpsCallable<{ guardianUid: string }, { token: string }>(
      functions,
      'switchToGuardian'
    );
    const result = await fn({ guardianUid });
    await signInWithCustomToken(getAuth(), result.data.token);
    EncryptionKeyManager.clearSession();
  },
};
