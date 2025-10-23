import { useState, useEffect, useCallback, useMemo } from 'react';
import { authService } from '@/components/auth/services/authServices';

export const useAuth = () => {
  // Use single state object instead of separate states
  const [authState, setAuthState] = useState({
    user: null,
    loading: true
  });

  useEffect(() => {
    // Check initial auth state
    const checkAuthState = () => {
      try {
        const currentUser = authService.getCurrentUser();
        
        // Single state update
        setAuthState({
          user: currentUser,
          loading: false
        });
      } catch (error) {
        console.error('Error checking auth state:', error);
        
        // Single state update for error case
        setAuthState({
          user: null,
          loading: false
        });
      }
    };

    // If your authService has onAuthStateChanged, use it for real-time updates
    if (authService.onAuthStateChanged) {
      const unsubscribe = authService.onAuthStateChanged((user) => {
        // Single batched state update
        setAuthState({
          user: user,
          loading: false
        });
      });

      // Cleanup subscription on unmount
      return () => {
        unsubscribe();
      };
    } else {
      // Fallback if no real-time listener available
      checkAuthState();
    }
  }, []);

  // Additional helper methods
  const signOut = useCallback(async () => {
    try {
      // Single state update for loading
      setAuthState(prev => ({ ...prev, loading: true }));
      
      await authService.signOut();
      
      // Single state update after sign out
      setAuthState({
        user: null,
        loading: false
      });
    } catch (error) {
      console.error('Sign out error:', error);
      
      // Reset loading on error
      setAuthState(prev => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  // Memoize isAuthenticated
  const isAuthenticated = useMemo(() => !!authState.user, [authState.user]);

  return {
    user: authState.user,
    loading: authState.loading,
    signOut,
    isAuthenticated
  };
};

export default useAuth;