// src/features/Dependents/hooks/useSwitchableAccounts.ts

import { useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import { AccountSwitchService } from '../services/accountSwitchService';
import type { BelroseUserProfile } from '@/types/core';

export interface SwitchableAccount {
  uid: string;
  profile: BelroseUserProfile | null;
}

export function useSwitchableAccounts() {
  const { user } = useAuthContext();
  const [dependents, setDependents] = useState<SwitchableAccount[]>([]);
  const [guardian, setGuardian] = useState<SwitchableAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      if (user.isDependent && user.dependentCreatedBy) {
        const guardianProfile = await getUserProfile(user.dependentCreatedBy);
        setGuardian({ uid: user.dependentCreatedBy, profile: guardianProfile });
        setDependents([]);
      } else {
        const db = getFirestore();
        const snap = await getDocs(
          query(
            collection(db, 'trusteeRelationships'),
            where('trusteeId', '==', user.uid),
            where('isDependentRelationship', '==', true),
            where('isActive', '==', true)
          )
        );

        const entries = await Promise.all(
          snap.docs.map(async d => {
            const rel = d.data();
            const profile = await getUserProfile(rel.trustorId);
            return { uid: rel.trustorId, profile };
          })
        );

        setDependents(entries);
        setGuardian(null);
      }
    } catch (err) {
      console.error('Failed to load switchable accounts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, user?.isDependent]);

  useEffect(() => {
    load();
  }, [load]);

  const switchToDependent = async (dependentUid: string) => {
    setIsSwitching(true);
    try {
      await AccountSwitchService.switchToDependent(dependentUid);
      // onAuthStateChanged fires → useAuth re-fetches → entire app updates
    } catch (err: any) {
      toast.error('Failed to switch account. Please try again.');
      setIsSwitching(false);
    }
  };

  const switchToGuardian = async () => {
    if (!user?.dependentCreatedBy) return;
    setIsSwitching(true);
    try {
      await AccountSwitchService.switchToGuardian(user.dependentCreatedBy);
    } catch (err: any) {
      toast.error('Failed to switch account. Please try again.');
      setIsSwitching(false);
    }
  };

  const hasMultipleAccounts = user?.isDependent ? !!guardian : dependents.length > 0;

  return {
    dependents,
    guardian,
    isLoading,
    isSwitching,
    switchToDependent,
    switchToGuardian,
    hasMultipleAccounts,
  };
}
