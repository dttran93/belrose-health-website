// src/features/Auth/components/EncryptionPasswordSetup.tsx

import React, { useState } from 'react';
import { Eye, EyeOff, Lock, AlertCircle, LaptopMinimalCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import PasswordStrengthIndicator from './ui/PasswordSTrengthIndicator';
import {
  validatePassword,
  validatePasswordConfirmation,
} from '@/components/auth/utils/PasswordStrength';
import { EncryptionSetupService } from '@/features/Encryption/services/encryptionSetupService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import InputField from './ui/InputField';

interface EncryptionPasswordSetupProps {
  onComplete: (data: { encryptionPassword: string; recoveryKey: string }) => void;
  isCompleted: boolean;
}

export const EncryptionPasswordSetup: React.FC<EncryptionPasswordSetupProps> = ({
  onComplete,
  isCompleted = false,
}) => {
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEncryptionPassword(e.target.value);
    setError('');
  };

  const handleSubmit = async () => {
    setError('');

    // Validation
    const passwordValidation = validatePassword(encryptionPassword, 12, 3);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error || 'Password does not meet requirements');
      return;
    }

    const confirmValidation = validatePasswordConfirmation(encryptionPassword, confirmPassword);
    if (!confirmValidation.valid) {
      setError(confirmValidation.error || 'Passwords do not match');
      return;
    }

    setIsProcessing(true);

    try {
      // Setup encryption in Firestore
      const recoveryKey = await EncryptionSetupService.setupEncryption(encryptionPassword);

      // Initialize session
      const metadata = await EncryptionSetupService.getEncryptionMetadata();
      if (metadata?.salt) {
        await EncryptionKeyManager.initializeFromPassword(encryptionPassword, metadata.salt);
      }

      toast.success('Encryption password set successfully');

      onComplete({
        encryptionPassword,
        recoveryKey,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to setup encryption');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {isCompleted && (
        <>
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Encryption Password Created</h2>
            <p className="text-gray-600 mt-2">
              This password protects all your sensitive data. No one sees your data without
              permission, even Belrose.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <LaptopMinimalCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-900 flex-1">
                <p className="font-semibold mb-2">
                  Your Encryption Password has been set up! Remember, this password:
                </p>
                <ul className="space-y-1 text-green-800 list-inside list-disc pl-0">
                  <li>Encrypts your health records</li>
                  <li>Protects your blockchain wallet</li>
                  <li className="text-red-700">
                    <b>
                      <i>
                        If lost, Belrose cannot recover this for you. Your only option is your
                        Recovery Key (Step 4)
                      </i>
                    </b>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {!isCompleted && (
        <>
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Create Encryption Password</h2>
            <p className="text-gray-600 mt-2">
              This password protects all your sensitive data. No one sees your data without
              permission, even Belrose.
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 flex-1">
                <p className="font-semibold mb-2">Your Encryption Password:</p>
                <ul className="space-y-1 text-blue-800 list-inside list-disc pl-0">
                  <li>Encrypts your health records</li>
                  <li>Protects your blockchain wallet</li>
                  <li>
                    Should be <b>different</b> than your login password
                  </li>
                  <li className="text-red-700">
                    <b>
                      <i>Belrose cannot recover this if lost</i>
                    </b>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="encryptionPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Encryption Password
              </label>
              <div className="relative">
                <InputField
                  id="encryptionPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={encryptionPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3"
                  placeholder="At least 12 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <PasswordStrengthIndicator password={encryptionPassword} showFeedback={true} />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Confirm Password
              </label>
              <InputField
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3"
                placeholder="Confirm your password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex space-x-3">
              <Button
                onClick={handleSubmit}
                disabled={isProcessing || !encryptionPassword || !confirmPassword}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Setting up...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EncryptionPasswordSetup;
