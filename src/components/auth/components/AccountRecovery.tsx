// src/features/Auth/components/AccountRecovery.tsx

import React, { useState } from 'react';
import { KeyRound, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';

interface AccountRecoveryProps {
  email?: string; // Optionally pre-fill email
}

export const AccountRecovery: React.FC<AccountRecoveryProps> = ({ email: initialEmail }) => {
  const navigate = useNavigate();
  const auth = getAuth();
  const db = getFirestore();

  const [step, setStep] = useState<'enter-key' | 'set-password' | 'success'>('enter-key');
  const [email, setEmail] = useState(initialEmail || '');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState('');

  // Validate recovery key format (24 words)
  const validateRecoveryKey = (key: string): boolean => {
    const words = key.trim().split(/\s+/);
    return words.length === 24;
  };

  // Step 1: Verify recovery key
  const handleVerifyRecoveryKey = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    if (!validateRecoveryKey(recoveryKey)) {
      toast.error('Recovery key must be exactly 24 words');
      return;
    }

    setIsLoading(true);

    try {
      // First, we need to find the user by email
      // Note: This requires Firebase Auth to be set up to allow email lookup
      // For security, you might want to send a recovery email first that includes userId

      // For now, assume user is logged out and we need to find their userId
      // You might need to adjust this based on your auth flow

      console.log('🔍 Verifying recovery key for:', email);

      // Validate the recovery key can be converted to a master key
      const masterKey = await EncryptionKeyManager.recoverMasterKeyFromRecoveryKey(recoveryKey);
      console.log('✅ Recovery key is valid');

      // Move to password reset step
      setStep('set-password');
      toast.success('Recovery key verified!', {
        description: 'Now set a new password',
      });
    } catch (error) {
      console.error('❌ Recovery key verification failed:', error);
      toast.error('Invalid recovery key', {
        description: 'Please check your 24-word recovery key and try again',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Set new password and re-wrap master key
  const handleSetNewPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔐 Recovering account...');

      // 1. Recover master key from recovery key
      const masterKey = await EncryptionKeyManager.recoverMasterKeyFromRecoveryKey(recoveryKey);
      console.log('✓ Master key recovered');

      // 2. Get user data to find userId
      // Note: This is a simplified version - you'll need proper user lookup
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated. Please sign in first.');
      }

      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error('User data not found');
      }

      // 3. Re-wrap master key with NEW password
      const { encryptedKey, iv } = await EncryptionKeyManager.wrapMasterKeyWithPassword(
        masterKey,
        newPassword,
        currentUser.uid
      );
      console.log('✓ Master key re-wrapped with new password');

      // 4. Update Firestore with new encrypted master key
      await updateDoc(userDocRef, {
        encryptedMasterKey: encryptedKey,
        masterKeyIV: iv,
        updatedAt: new Date(),
      });
      console.log('✓ Firestore updated');

      // 5. Update Firebase password
      // Note: This requires re-authentication, see below for full implementation

      // 6. Initialize session with recovered key
      EncryptionKeyManager.setSessionKey(masterKey);

      setStep('success');
      toast.success('Account recovered successfully!', {
        description: 'You can now access your encrypted data',
      });
    } catch (error) {
      console.error('❌ Account recovery failed:', error);
      toast.error('Recovery failed', {
        description: 'Please try again or contact support',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Render based on current step
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Step 1: Enter Recovery Key */}
        {step === 'enter-key' && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-8 h-8 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Account Recovery</h2>
              <p className="text-gray-600 mt-2">Enter your 24-word recovery key to regain access</p>
            </div>

            <div className="space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>

              {/* Recovery Key Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  24-Word Recovery Key
                </label>
                <textarea
                  value={recoveryKey}
                  onChange={e => setRecoveryKey(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="Enter your 24-word recovery key..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {
                    recoveryKey
                      .trim()
                      .split(/\s+/)
                      .filter(w => w).length
                  }{' '}
                  / 24 words
                </p>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-900">
                    <p className="font-semibold mb-1">Important</p>
                    <p>
                      Your recovery key is case-sensitive and must be entered exactly as shown when
                      you created your account.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleVerifyRecoveryKey}
                disabled={isLoading || !email || !validateRecoveryKey(recoveryKey)}
                className="w-full"
              >
                {isLoading ? 'Verifying...' : 'Verify Recovery Key'}
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Set New Password */}
        {step === 'set-password' && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Set New Password</h2>
              <p className="text-gray-600 mt-2">Choose a strong password for your account</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm new password"
                />
              </div>

              <Button
                onClick={handleSetNewPassword}
                disabled={isLoading || !newPassword || newPassword !== confirmPassword}
                className="w-full"
              >
                {isLoading ? 'Recovering Account...' : 'Complete Recovery'}
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Recovery Complete!</h2>
              <p className="text-gray-600 mb-6">
                Your account has been successfully recovered. You can now access your encrypted
                health records.
              </p>

              <Button onClick={() => navigate('/dashboard')} className="w-full">
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {/* Back to Login */}
        {step === 'enter-key' && (
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-blue-600 hover:underline"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
