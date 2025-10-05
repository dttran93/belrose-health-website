//Encryption/components/EncryptionGate.tsx
import React, { useEffect, useState } from 'react';
import { EncryptionPasswordPrompt } from '@/features/Encryption/components/EncryptionPasswordPrompt';
import { EncryptionSetupService } from '@/features/Encryption/services/encryptionSetupService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { getAuth } from 'firebase/auth';

interface EncryptionGateProps {
  children: React.ReactNode;
}

export const EncryptionGate: React.FC<EncryptionGateProps> = ({ children }) => {
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkEncryptionStatus();
  }, []);

  const checkEncryptionStatus = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setIsChecking(false);
      return;
    }

    try {
      // Check if user has encryption enabled
      const encryptionMetadata = await EncryptionSetupService.getEncryptionMetadata();
      
      if (encryptionMetadata?.enabled) {
        // Check if already unlocked
        const hasActiveSession = EncryptionKeyManager.hasActiveSession();
        
        if (!hasActiveSession) {
          setNeedsUnlock(true);
        }
      }
    } catch (error) {
      console.error('Error checking encryption status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleUnlocked = () => {
    setNeedsUnlock(false);
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      {children}
      {needsUnlock && <EncryptionPasswordPrompt onUnlocked={handleUnlocked} />}
    </>
  );
};