import { useState, useEffect, useCallback, useMemo } from 'react';
import { authService } from '@/features/Auth/services/authServices';
import { UserService } from '../services/userService';
import { UserSettingsService } from '@/features/Settings/services/userSettingsService';
import { AuthContextData, BelroseUserProfile } from '@/types/core';
import { User as FirebaseAuthUser } from 'firebase/auth';

// Define the shape of the internal hook state
interface AuthState {
  user: BelroseUserProfile | null;
  loading: boolean;
}

export const useAuth = (): AuthContextData => {
  // Initialize state with the AuthState interface
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  // Helper function to fetch profile and merge (now using the logic we developed)
  const fetchAndMergeProfile = useCallback(async (user: FirebaseAuthUser) => {
    let mergedUser: BelroseUserProfile | null = null;

    try {
      const profile = await UserService.getUserProfile(user.uid);

      if (profile) {
        // Explicitly construct the BelroseUserProfile object by merging Auth and Firestore data.
        // 1. user (FirebaseAuthUser) - For uid, email, displayName, photoURL, emailVerified
        // 2. profile (Firestore document) - For all custom Belrose fields
        mergedUser = {
          uid: user.uid,
          email: user.email,
          displayName: profile.displayName || user.displayName,
          firstName: profile.firstName || null, // From Firestore Profile
          lastName: profile.lastName || null, // From Firestore Profile
          photoURL: user.photoURL,
          encryption: profile.encryption,
          createdAt: profile.createdAt || null,
          updatedAt: profile.updatedAt || null,
          wallet: profile.wallet,
          emailVerified: user.emailVerified, //pull from Firebase, more authoritative since it IS the backend
          emailVerifiedAt: profile.emailVerifiedAt || null,
          identityVerified: profile.identityVerified || false, // Use false if missing
          identityVerifiedAt: profile.identityVerifiedAt || null,
          onChainIdentity: profile.onChainIdentity || undefined,
          affiliations: profile.affiliations || [],
          isGuest: profile.isGuest || false,
          isDependent: profile.isDependent || false,
          dependentCreatedBy: profile.dependentCreatedBy || undefined,
        } as BelroseUserProfile;

        if (profile.email !== user.email && user.email) {
          console.log('Email change detected, syncing to Firestore...');
          await UserSettingsService.syncEmailToFirestore(
            user.uid,
            user.email, // Safe because of the 'if' condition
            user.emailVerified
          );
        }
        const idTokenResult = await user.getIdTokenResult(true);
        mergedUser.isPlatformAdmin = idTokenResult.claims.platformAdmin === true;
        mergedUser.signInProvider = idTokenResult.signInProvider ?? undefined;
      }
    } catch (error) {
      console.error('Error fetching or syncing user profile:', error);
      // If the profile fetch fails entirely, return null or a minimal user (safer to return null/undefined)
      return null;
    }

    return mergedUser;
  }, []);

  useEffect(() => {
    // The listener handles real-time auth changes
    const unsubscribe = authService.onAuthStateChanged(async (user: FirebaseAuthUser | null) => {
      setAuthState(prev => ({ ...prev, loading: true }));
      let mergedUser: BelroseUserProfile | null = null;

      if (user) {
        mergedUser = await fetchAndMergeProfile(user); // Use the helper function
      }

      // Single batched state update with the MERGED user object
      setAuthState({
        user: mergedUser,
        loading: false,
      });
    });

    return () => unsubscribe();
  }, []);

  // Additional helper methods
  const signOut = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));

      await authService.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  // Memoize isAuthenticated
  const isAuthenticated = useMemo(() => !!authState.user, [authState.user]);

  const refreshUser = useCallback(async () => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      // 1. Force Firebase to fetch the latest token/state (emailVerified)
      await currentUser.reload();

      // 2. Get the fresh reloaded user instance
      const freshUser = authService.getCurrentUser();

      if (freshUser) {
        // 3. Re-run your merge logic to get a fresh BelroseUserProfile
        const mergedUser = await fetchAndMergeProfile(freshUser);

        // 4. Update state to trigger re-renders globally
        setAuthState({
          user: mergedUser,
          loading: false,
        });
      }
    }
  }, [fetchAndMergeProfile]);

  // Return the data that satisfies the AuthContextData type
  return {
    user: authState.user,
    loading: authState.loading,
    signOut,
    isAuthenticated,
    refreshUser,
  };
};

export default useAuth;
