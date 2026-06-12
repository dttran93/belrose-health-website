// src/features/Dependents/services/dependentManagementService.ts

import { getFunctions, httpsCallable } from 'firebase/functions';

export const DependentManagementService = {
  async initiateHandoff(dependentUid: string, contactEmail: string): Promise<void> {
    const fn = httpsCallable(getFunctions(), 'initiateHandoff');
    await fn({ dependentUid, contactEmail });
  },

  async removeDependent(dependentUid: string): Promise<void> {
    const fn = httpsCallable(getFunctions(), 'removeDependentRelationship');
    await fn({ dependentUid });
  },
};
