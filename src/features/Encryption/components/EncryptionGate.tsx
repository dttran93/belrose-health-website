// src/features/Encryption/components/EncryptionGate.tsx
import React, { useEffect, useState } from 'react';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import InputField from '@/components/ui/InputField';

interface EncryptionGateProps {
  children: React.ReactNode;
}

export const EncryptionGate: React.FC<EncryptionGateProps> = ({ children }) => {
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    checkEncryptionStatus();

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
      const hasActiveSession = await EncryptionKeyManager.hasActiveSession();

      if (!hasActiveSession) {
        console.log('⚠️ No active encryption session detected');
        setDisplayName(user.displayName ?? 'your account');
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

  const handleUnlock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!password) {
      setPasswordError('Password is required');
      return;
    }

    setIsUnlocking(true);
    setPasswordError('');

    try {
      const auth = getAuth();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('No authenticated user');

      const db = getFirestore();
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) throw new Error('User data not found');

      const enc = userDoc.data().encryption;
      if (!enc?.encryptedMasterKey || !enc?.masterKeyIV || !enc?.masterKeySalt) {
        throw new Error('Encryption data not found');
      }

      await EncryptionKeyManager.initializeSessionWithPassword(
        enc.encryptedMasterKey,
        enc.masterKeyIV,
        password,
        enc.masterKeySalt
      );

      setPassword('');
      setNeedsUnlock(false);
      toast.success('Account unlocked');
    } catch (error: any) {
      // Wrong password produces a DOMException from the AES-GCM decryption
      if (error instanceof DOMException || error?.message?.includes('decrypt')) {
        setPasswordError('Incorrect password, please try again');
      } else {
        setPasswordError('Failed to unlock. Please try again.');
        console.error('Unlock error:', error);
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleSignOut = async () => {
    EncryptionKeyManager.clearSession();
    await signOut(getAuth());
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (needsUnlock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Unlock Account</h2>
            <p className="text-gray-600">
              Enter the password for <span className="font-medium">{displayName}</span> to continue.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative">
              <InputField
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setPasswordError('');
                }}
                error={passwordError}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={isUnlocking}>
              {isUnlocking ? 'Unlocking…' : 'Unlock'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-400 hover:text-gray-600 underline"
            >
              Sign out instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
