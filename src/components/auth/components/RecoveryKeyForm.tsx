// src/components/auth/components/RecoveryKeyForm.tsx
// CORRECT VERSION using EncryptionKeyManager

import React, { useState } from 'react';
import { KeyRound, CheckCircle, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { toast } from 'sonner';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

interface RecoveryKeyFormProps {
  onBackToLogin: () => void;
}

type RecoveryStep = 'verifyKey' | 'setNewPassword' | 'success';

export const RecoveryKeyForm: React.FC<RecoveryKeyFormProps> = ({ onBackToLogin }) => {
  const [currentStep, setCurrentStep] = useState<RecoveryStep>('verifyKey');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Verify Recovery Key
  const handleVerifyRecoveryKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!recoveryKey.trim()) {
      setError('Please enter your 24-word recovery key');
      return;
    }

    setIsLoading(true);

    try {
      const auth = getAuth();
      const db = getFirestore();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Validate recovery key format
      const isValid = EncryptionKeyManager.validateRecoveryKey(recoveryKey.trim());

      if (!isValid) {
        setError('Invalid recovery key format. Please check and try again.');
        toast.error('Invalid recovery key format');
        return;
      }

      // Get stored recovery key hash from Firestore
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data();
      const storedRecoveryKeyHash = userData.encryption?.recoveryKeyHash;

      if (!storedRecoveryKeyHash) {
        throw new Error('No recovery key found for this account');
      }

      // Hash the provided recovery key and compare
      const providedRecoveryKeyHash = await EncryptionKeyManager.hashRecoveryKey(
        recoveryKey.trim()
      );

      if (providedRecoveryKeyHash !== storedRecoveryKeyHash) {
        setError('Incorrect recovery key. Please check and try again.');
        toast.error('Incorrect recovery key');
        return;
      }

      // Initialize encryption session from recovery key
      // This derives the Master Key directly from the recovery key
      await EncryptionKeyManager.initializeSessionWithRecoveryKey(recoveryKey.trim());

      toast.success('Recovery key verified!');
      setCurrentStep('setNewPassword');
    } catch (err) {
      console.error('Recovery key verification error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify recovery key';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Validate Password
  const validatePassword = (password: string): { valid: boolean; error?: string } => {
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters' };
    }

    let criteriaCount = 0;
    if (/[a-z]/.test(password)) criteriaCount++;
    if (/[A-Z]/.test(password)) criteriaCount++;
    if (/\d/.test(password)) criteriaCount++;
    if (/[^a-zA-Z0-9]/.test(password)) criteriaCount++;

    if (criteriaCount < 3) {
      return {
        valid: false,
        error:
          'Password must contain at least 3 of: lowercase, uppercase, number, special character',
      };
    }

    return { valid: true };
  };

  // Step 2: Set New Password
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error || 'Password does not meet requirements');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const auth = getAuth();
      const db = getFirestore();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get the Master Key from the active session
      const masterKey = EncryptionKeyManager.getSessionKey();
      if (!masterKey) {
        throw new Error('No active encryption session. Please verify recovery key again.');
      }

      // Wrap the Master Key with the new password
      // This creates a new KEK from the new password and encrypts the Master Key with it
      const { encryptedKey, iv } = await EncryptionKeyManager.wrapMasterKeyWithPassword(
        masterKey,
        newPassword,
        user.uid
      );

      // Hash the new password for verification purposes
      const encoder = new TextEncoder();
      const passwordData = new Uint8Array([
        ...encoder.encode(newPassword),
        ...encoder.encode(user.uid),
      ]);
      const hashBuffer = await crypto.subtle.digest('SHA-256', passwordData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Update Firestore with new wrapped key and password hash
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'encryption.encryptedMasterKey': encryptedKey,
        'encryption.masterKeyIV': iv,
        'encryption.passwordHash': passwordHash,
        'encryption.lastPasswordUpdate': new Date().toISOString(),
      });

      toast.success('Password updated successfully!');
      setCurrentStep('success');
    } catch (err) {
      console.error('Password update error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update password';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Verify Recovery Key
  if (currentStep === 'verifyKey') {
    return (
      <div>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-secondary" />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">Enter Recovery Key</h1>
          <p className="text-foreground">
            Enter your 24-word recovery key to restore access to your encrypted data
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">What This Does</p>
              <p>
                Your recovery key will restore access to your encrypted health data and allow you to
                set a new password.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleVerifyRecoveryKey} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              24-Word Recovery Key
            </label>
            <textarea
              value={recoveryKey}
              onChange={e => setRecoveryKey(e.target.value)}
              className={`w-full p-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono text-sm ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="word1 word2 word3 ... word24"
              rows={4}
              disabled={isLoading}
            />
            <p className="mt-2 text-xs text-gray-600">Enter all 24 words separated by spaces</p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>

          <Button
            type="submit"
            disabled={isLoading || !recoveryKey.trim()}
            size="lg"
            className="w-full"
          >
            {isLoading ? 'Verifying...' : 'Verify Recovery Key'}
          </Button>
        </form>

        {/* Help Section */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600 mb-3">Don't have your recovery key?</p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-900">
              Without your recovery key, your encrypted health data cannot be recovered. You can
              still access your Belrose account, but you'll need to start with a fresh encryption
              setup.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Set New Password
  if (currentStep === 'setNewPassword') {
    return (
      <div>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">Recovery Key Verified!</h1>
          <p className="text-foreground">Now set a new password for your account</p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">New Password</p>
              <p>
                This password will be used to log into your Belrose account and unlock your
                encrypted health data. Choose something secure and memorable.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSetNewPassword} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className={`w-full p-3 pr-10 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
                  error ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter new password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              At least 8 characters with 3 of: lowercase, uppercase, number, special character
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className={`w-full p-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Confirm new password"
              disabled={isLoading}
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>

          <Button
            type="submit"
            disabled={isLoading || !newPassword || !confirmPassword}
            size="lg"
            className="w-full"
          >
            {isLoading ? 'Updating...' : 'Set New Password'}
          </Button>
        </form>
      </div>
    );
  }

  // Step 3: Success
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>

      <h1 className="text-2xl font-bold text-primary mb-2">Recovery Complete!</h1>
      <p className="text-foreground mb-6">
        Your password has been updated successfully. You can now access your encrypted health data
        with your new password.
      </p>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-900">
            <p className="font-semibold mb-2">What's Next:</p>
            <ul className="space-y-1">
              <li>• Your encrypted data is now accessible</li>
              <li>• Use your new password to log in and unlock data</li>
              <li>• Keep your recovery key safe for future use</li>
            </ul>
          </div>
        </div>
      </div>

      <Button onClick={onBackToLogin} size="lg" className="w-full">
        Go to Login
      </Button>
    </div>
  );
};

export default RecoveryKeyForm;
