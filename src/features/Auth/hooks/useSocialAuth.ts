// /features/Auth/hooks/useSocialAuth.ts

import { useState } from 'react';
import { authService } from '@/features/Auth/services/authServices';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';

interface FirebaseError extends Error {
  code?: string;
}

export const useSocialAuth = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSocialSignIn = async (
    provider: string,
    authFunction: () => Promise<any>
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const user = await authFunction();
      console.log(`${provider} sign in successful:`, user);

      toast.success(`${provider} sign in successful!`, {
        description: `Welcome! You have been signed in with ${provider}.`,
        duration: 3000,
      });

      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      console.error(`${provider} sign in error:`, error);
      const firebaseError = error as FirebaseError;

      toast.error(`${provider} sign in failed`, {
        description: firebaseError.message || `Failed to sign in with ${provider}`,
        duration: 4000,
      });

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    handleGoogleSignIn: () => handleSocialSignIn('Google', authService.signInWithGoogle),
    handleFacebookSignIn: () => handleSocialSignIn('Facebook', authService.signInWithFacebook),
    handleGitHubSignIn: () => handleSocialSignIn('GitHub', authService.signInWithGitHub),
  };
};
