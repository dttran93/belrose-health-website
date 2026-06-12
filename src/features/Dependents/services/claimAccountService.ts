import { getFunctions, httpsCallable } from 'firebase/functions';

export const ClaimAccountService = {
  async claimAccount(): Promise<void> {
    const fn = httpsCallable<Record<string, never>, { success: boolean }>(
      getFunctions(),
      'claimDependentAccount'
    );
    await fn({});
  },
};
