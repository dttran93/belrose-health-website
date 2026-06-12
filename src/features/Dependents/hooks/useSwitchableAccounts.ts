// src/features/Dependents/hooks/useSwitchableAccounts.ts

import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';
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

  useEffect(() => {
    if (!user) return;

    if (user.isDependent && user.dependentCreatedBy) {
      // Dependent: guardian is fixed at account creation — one-time fetch is fine
      setIsLoading(true);
      getUserProfile(user.dependentCreatedBy)
        .then(profile => {
          setGuardian({ uid: user.dependentCreatedBy!, profile });
          setDependents([]);
        })
        .catch(err => console.error('Failed to load guardian profile:', err))
        .finally(() => setIsLoading(false));
      return;
    }

    // Guardian: real-time listener so newly created dependents appear immediately
    const db = getFirestore();
    setIsLoading(true);

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'trusteeRelationships'),
        where('trusteeId', '==', user.uid),
        where('isDependentRelationship', '==', true),
        where('isActive', '==', true)
      ),
      async snapshot => {
        try {
          const entries = await Promise.all(
            snapshot.docs.map(async d => {
              const rel = d.data();
              const profile = await getUserProfile(rel.trustorId);
              return { uid: rel.trustorId, profile };
            })
          );
          setDependents(entries);
          setGuardian(null);
        } catch (err) {
          console.error('Failed to load switchable accounts:', err);
        } finally {
          setIsLoading(false);
        }
      },
      err => {
        console.error('Switchable accounts listener error:', err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, user?.isDependent, user?.dependentCreatedBy]);

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
