// features/Encryption/components/EncryptionPasswordPrompt.tsx
import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, KeyRound } from 'lucide-react';
import { EncryptionSetupService } from '../services/encryptionSetupService';
import { EncryptionKeyManager } from '../services/encryptionKeyManager';
import { toast } from 'sonner';

interface EncryptionPasswordPromptProps {
  onUnlocked: () => void;
  allowSkip?: boolean;
  onSkip?: () => void;
}

export const EncryptionPasswordPrompt: React.FC<EncryptionPasswordPromptProps> = ({
  onUnlocked,
  allowSkip = false,
  onSkip,
}) => {
  const [mode, setMode] = useState<'password' | 'recovery'>('password');
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const handleUnlockWithPassword = async () => {
    if (!password.trim()) return;

    setIsVerifying(true);
    setError('');

    try {
      // Verify password against stored hash
      const isValid = await EncryptionSetupService.verifyPassword(password);

      if (!isValid) {
        setAttempts(prev => prev + 1);
        setError('Incorrect password. Please try again.');
        setPassword('');
        toast.error('Incorrect password');
        return;
      }

      // Get user's salt and initialize session
      const metadata = await EncryptionSetupService.getEncryptionMetadata();
      if (!metadata?.salt) {
        throw new Error('Encryption metadata not found');
      }

      await EncryptionKeyManager.initializeFromPassword(password, metadata.salt);
      await EncryptionSetupService.updateLastUnlocked();

      toast.success('Encryption unlocked');
      onUnlocked();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unlock encryption';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUnlockWithRecoveryKey = async () => {
    if (!recoveryKey.trim()) return;

    setIsVerifying(true);
    setError('');

    try {
      // Verify recovery key format
      const isValid = await EncryptionSetupService.verifyRecoveryKey(recoveryKey);

      if (!isValid) {
        setAttempts(prev => prev + 1);
        setError('Invalid recovery key. Please check and try again.');
        setRecoveryKey('');
        toast.error('Invalid recovery key');
        return;
      }

      // Get user's salt and initialize session from recovery key
      const metadata = await EncryptionSetupService.getEncryptionMetadata();
      if (!metadata?.salt) {
        throw new Error('Encryption metadata not found');
      }

      await EncryptionKeyManager.initializeFromRecoveryKey(recoveryKey, metadata.salt);
      await EncryptionSetupService.updateLastUnlocked();

      toast.success('Encryption unlocked with recovery key');
      onUnlocked();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unlock with recovery key';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (mode === 'password') {
        handleUnlockWithPassword();
      } else {
        handleUnlockWithRecoveryKey();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Unlock Encryption</h2>
            <p className="text-sm text-gray-600">Enter your password to access encrypted records</p>
          </div>
        </div>

        {attempts >= 3 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold">Multiple failed attempts</p>
                <p className="mt-1">
                  If you've forgotten your password, you can use your 24-word recovery key instead.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {mode === 'password' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Encryption Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your encryption password"
                  className="w-full px-3 py-2 border rounded-lg pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              onClick={handleUnlockWithPassword}
              disabled={!password.trim() || isVerifying}
              className={`w-full py-3 rounded-lg font-semibold ${
                password.trim() && !isVerifying
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isVerifying ? 'Verifying...' : 'Unlock'}
            </button>

            <button
              onClick={() => setMode('recovery')}
              className="w-full flex items-center justify-center space-x-2 py-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <KeyRound className="w-4 h-4" />
              <span>Use recovery key instead</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recovery Key (24 words)
              </label>
              <textarea
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="word1 word2 word3 ..."
                rows={4}
                className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter all 24 words separated by spaces
              </p>
            </div>

            <button
              onClick={handleUnlockWithRecoveryKey}
              disabled={!recoveryKey.trim() || isVerifying}
              className={`w-full py-3 rounded-lg font-semibold ${
                recoveryKey.trim() && !isVerifying
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isVerifying ? 'Verifying...' : 'Unlock with Recovery Key'}
            </button>

            <button
              onClick={() => setMode('password')}
              className="w-full py-2 text-sm text-gray-600 hover:text-gray-700"
            >
              Back to password
            </button>
          </div>
        )}

        {allowSkip && onSkip && (
          <div className="border-t pt-4">
            <button
              onClick={onSkip}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-600"
            >
              Skip for now (you won't be able to access encrypted records)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};