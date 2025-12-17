import { useState, useEffect, useCallback, useMemo } from 'react';
// Assuming these are all correctly imported/typed services
import { authService } from '@/features/Auth/services/authServices';
import { UserService } from '../services/userService';
import { UserSettingsService } from '@/features/Settings/services/userSettingsService';
// Import your core types
import { AuthContextData, BelroseUserProfile } from '@/types/core';
import { User as FirebaseAuthUser } from 'firebase/auth'; // Assuming Firebase Auth user type

// Define the shape of the internal hook state
interface AuthState {
  user: BelroseUserProfile | null;
  loading: boolean;
}

// Define the return type of the useAuth hook, matching AuthContextData
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
          displayName: user.displayName,
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
          blockchainMember: profile.blockchainMember || undefined,
          affiliations: profile.affiliations || [],
        } as BelroseUserProfile;

        // ... (Your email sync logic remains here, using baseAuthUser.email!) ...
        if (profile.email !== user.email && user.email) {
          console.log('Email change detected, syncing to Firestore...');
          await UserSettingsService.syncEmailToFirestore(
            user.uid,
            user.email, // Safe because of the 'if' condition
            user.emailVerified
          );
        }
      }
    } catch (error) {
      console.error('Error fetching or syncing user profile:', error);
      // If the profile fetch fails entirely, return null or a minimal user (safer to return null/undefined)
      return null;
    }

    return mergedUser;
  }, []);

  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const currentUser = authService.getCurrentUser();
        let user: BelroseUserProfile | null = null;

        if (currentUser) {
          // Check initial state, still need to merge profile
          user = await fetchAndMergeProfile(currentUser);
        }

        setAuthState({
          user,
          loading: false,
        });
      } catch (error) {
        console.error('Error checking auth state:', error);
        setAuthState({
          user: null,
          loading: false,
        });
      }
    };

    if (authService.onAuthStateChanged) {
      // The listener handles real-time auth changes
      const unsubscribe = authService.onAuthStateChanged(async (user: FirebaseAuthUser | null) => {
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

      return () => {
        unsubscribe();
      };
    } else {
      checkAuthState();
    }
  }, [fetchAndMergeProfile]); // Depend on fetchAndMergeProfile

  // Additional helper methods
  const signOut = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));

      await authService.signOut();

      setAuthState({
        user: null,
        loading: false,
      });
    } catch (error) {
      console.error('Sign out error:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  // Memoize isAuthenticated
  const isAuthenticated = useMemo(() => !!authState.user, [authState.user]);

  // Return the data that satisfies the AuthContextData type
  return {
    user: authState.user,
    loading: authState.loading,
    signOut,
    isAuthenticated,
  };
};

export default useAuth;
