// src/features/Settings/hooks/useUserSettings.ts

import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { UserSettingsService } from '../services/userSettingsService';
import { UserService } from '@/components/auth/services/userService';
import { BelroseUserProfile } from '@/types/core';

interface UseUserSettingsOptions {
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
}

interface UseUserSettingsReturn {
  // Loading states
  isUpdatingName: boolean;
  isUpdatingEmail: boolean;
  isUpdatingPhoto: boolean;
  isResendingVerification: boolean;

  // Actions
  updateName: (firstName: string, lastName: string) => Promise<boolean>;
  updateEmail: (newEmail: string, currentPassword: string) => Promise<boolean>;
  updatePhoto: (photoURL: string | null) => Promise<boolean>;
  resendEmailVerification: () => Promise<boolean>;

  // Refresh user data
  refreshUserProfile: () => Promise<BelroseUserProfile | null>;
}

/**
 * Hook for managing user settings updates
 */
export function useUserSettings(options: UseUserSettingsOptions = {}): UseUserSettingsReturn {
  const { onSuccess, onError } = options;

  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  const auth = getAuth();

  // Helper to handle success
  const handleSuccess = useCallback(
    (message: string) => {
      toast.success(message);
      onSuccess?.(message);
    },
    [onSuccess]
  );

  // Helper to handle errors
  const handleError = useCallback(
    (error: string) => {
      toast.error(error);
      onError?.(error);
    },
    [onError]
  );

  /**
   * Update user's name
   */
  const updateName = useCallback(
    async (firstName: string, lastName: string): Promise<boolean> => {
      const user = auth.currentUser;
      if (!user) {
        handleError('Not authenticated');
        return false;
      }

      setIsUpdatingName(true);
      try {
        await UserSettingsService.updateName(user.uid, firstName, lastName);
        handleSuccess('Name updated successfully');
        return true;
      } catch (error: any) {
        handleError(error.message || 'Failed to update name');
        return false;
      } finally {
        setIsUpdatingName(false);
      }
    },
    [auth, handleSuccess, handleError]
  );

  /**
   * Update user's email
   */
  const updateEmail = useCallback(
    async (newEmail: string, currentPassword: string): Promise<boolean> => {
      const user = auth.currentUser;
      if (!user) {
        handleError('Not authenticated');
        return false;
      }

      setIsUpdatingEmail(true);
      try {
        await UserSettingsService.updateEmail(user.uid, newEmail, currentPassword);
        handleSuccess('Email updated. Please check your inbox to verify your new email address.');
        return true;
      } catch (error: any) {
        handleError(error.message || 'Failed to update email');
        return false;
      } finally {
        setIsUpdatingEmail(false);
      }
    },
    [auth, handleSuccess, handleError]
  );

  /**
   * Update user's profile photo
   */
  const updatePhoto = useCallback(
    async (photoURL: string | null): Promise<boolean> => {
      const user = auth.currentUser;
      if (!user) {
        handleError('Not authenticated');
        return false;
      }

      setIsUpdatingPhoto(true);
      try {
        await UserSettingsService.updateProfilePhoto(user.uid, photoURL);
        handleSuccess('Profile photo updated');
        return true;
      } catch (error: any) {
        handleError(error.message || 'Failed to update profile photo');
        return false;
      } finally {
        setIsUpdatingPhoto(false);
      }
    },
    [auth, handleSuccess, handleError]
  );

  /**
   * Resend email verification
   */
  const resendEmailVerification = useCallback(async (): Promise<boolean> => {
    setIsResendingVerification(true);
    try {
      await UserSettingsService.resendEmailVerification();
      handleSuccess('Verification email sent. Please check your inbox.');
      return true;
    } catch (error: any) {
      handleError(error.message || 'Failed to send verification email');
      return false;
    } finally {
      setIsResendingVerification(false);
    }
  }, [handleSuccess, handleError]);

  /**
   * Refresh user profile data from Firestore
   */
  const refreshUserProfile = useCallback(async (): Promise<BelroseUserProfile | null> => {
    const user = auth.currentUser;
    if (!user) return null;

    try {
      return await UserService.getUserProfile(user.uid);
    } catch (error) {
      console.error('Error refreshing user profile:', error);
      return null;
    }
  }, [auth]);

  return {
    isUpdatingName,
    isUpdatingEmail,
    isUpdatingPhoto,
    isResendingVerification,
    updateName,
    updateEmail,
    updatePhoto,
    resendEmailVerification,
    refreshUserProfile,
  };
}
