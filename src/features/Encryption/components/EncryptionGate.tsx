// src/features/Encryption/components/EncryptionGate.tsx
import React, { useEffect, useState } from 'react';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { getAuth, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface EncryptionGateProps {
  children: React.ReactNode;
}

export const EncryptionGate: React.FC<EncryptionGateProps> = ({ children }) => {
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkEncryptionStatus();

    // Set up periodic session check (every minute)
    const intervalId = setInterval(checkEncryptionStatus, 60000);

    return () => clearInterval(intervalId);
  }, []);

  const checkEncryptionStatus = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setIsChecking(false);
      return;
    }

    try {
      // Check if encryption session is active
      const hasActiveSession = EncryptionKeyManager.hasActiveSession();

      if (!hasActiveSession) {
        console.log('⚠️ No active encryption session detected');
        setNeedsUnlock(true);
      } else {
        setNeedsUnlock(false);
      }
    } catch (error) {
      console.error('Error checking encryption status:', error);
      setNeedsUnlock(true);
    } finally {
      setIsChecking(false);
    }
  };

  const handleReauthenticate = async () => {
    const auth = getAuth();

    // Clear the expired session
    EncryptionKeyManager.clearSession();

    // Sign out user
    await signOut(auth);

    toast.info('Session expired. Please sign in again.', {
      description: 'Your encryption session has expired for security.',
    });

    // Redirect to login
    navigate('/login', {
      replace: true,
      state: { sessionExpired: true },
    });
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If session expired, show re-authentication prompt
  if (needsUnlock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-yellow-600" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Expired</h2>

            <p className="text-gray-600 mb-6">
              Your encryption session has expired for security. Please sign in again to continue.
            </p>

            <Button onClick={handleReauthenticate} className="w-full">
              Sign In Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
