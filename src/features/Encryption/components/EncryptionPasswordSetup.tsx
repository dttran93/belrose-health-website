// features/Encryption/components/EncryptionPasswordSetup.tsx
import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, CheckCircle, Copy, Download } from 'lucide-react';
import { EncryptionSetupService } from '../services/encryptionSetupService';
import { EncryptionKeyManager } from '../services/encryptionKeyManager';
import { toast } from 'sonner';

interface EncryptionPasswordSetupProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export const EncryptionPasswordSetup: React.FC<EncryptionPasswordSetupProps> = ({
  onComplete,
  onCancel,
}) => {
  const [step, setStep] = useState<'password' | 'recovery'>('password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Password strength calculation
  const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (pwd.length === 0) return { score: 0, label: '', color: '' };
    
    let score = 0;
    if (pwd.length >= 12) score++;
    if (pwd.length >= 16) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: 'Weak', color: 'text-red-600' };
    if (score === 3) return { score, label: 'Fair', color: 'text-yellow-600' };
    if (score === 4) return { score, label: 'Good', color: 'text-blue-600' };
    return { score, label: 'Strong', color: 'text-green-600' };
  };

  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canProceed = password.length >= 12 && passwordsMatch && passwordStrength.score >= 3;

  const handleSetupPassword = async () => {
    if (!canProceed) return;

    setIsSubmitting(true);
    setError('');

    try {
      // Setup encryption in Firestore
      const generatedRecoveryKey = await EncryptionSetupService.setupEncryption(password);
      
      // Initialize session
      const metadata = await EncryptionSetupService.getEncryptionMetadata();
      if (metadata?.salt) {
        await EncryptionKeyManager.initializeFromPassword(password, metadata.salt);
      }

      // Move to recovery key step
      setRecoveryKey(generatedRecoveryKey);
      setStep('recovery');
      
      toast.success('Encryption password set successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to setup encryption';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyRecoveryKey = () => {
    navigator.clipboard.writeText(recoveryKey);
    toast.success('Recovery key copied to clipboard');
  };

  const handleDownloadRecoveryKey = () => {
    const blob = new Blob([
      'Belrose Health Records - Encryption Recovery Key\n\n',
      'IMPORTANT: Store this recovery key in a safe place.\n',
      'If you forget your encryption password, this is the ONLY way to recover your data.\n\n',
      'Recovery Key:\n',
      recoveryKey,
      '\n\nDate Generated: ',
      new Date().toISOString(),
    ], { type: 'text/plain' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `belrose-recovery-key-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Recovery key downloaded');
  };

  const handleComplete = () => {
    if (!acknowledged) {
      toast.error('Please confirm you have saved your recovery key');
      return;
    }
    onComplete();
  };

  if (step === 'recovery') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-2xl w-full p-6 space-y-4">
          <div className="flex items-center space-x-2 text-green-600">
            <CheckCircle className="w-6 h-6" />
            <h2 className="text-2xl font-bold">Encryption Enabled</h2>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-2">Save Your Recovery Key</p>
                <p>
                  This 24-word recovery key is the ONLY way to recover your data if you forget your
                  encryption password. Without it, your health records will be permanently
                  inaccessible.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border rounded p-4">
            <p className="text-sm text-gray-600 mb-2">Your Recovery Key:</p>
            <div className="bg-white border rounded p-3 font-mono text-sm break-all">
              {recoveryKey}
            </div>
            
            <div className="flex space-x-2 mt-3">
              <button
                onClick={handleCopyRecoveryKey}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 border rounded hover:bg-gray-50"
              >
                <Copy className="w-4 h-4" />
                <span>Copy</span>
              </button>
              <button
                onClick={handleDownloadRecoveryKey}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 border rounded hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Recommended storage options:</p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Save in a password manager (1Password, Bitwarden, LastPass)</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Write it down and store in a safe or safety deposit box</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Store encrypted in cloud storage with a different password</span>
              </li>
            </ul>
          </div>

          <div className="border-t pt-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm">
                I have saved my recovery key in a secure location. I understand that without this
                key, I cannot recover my data if I forget my encryption password.
              </span>
            </label>
          </div>

          <button
            onClick={handleComplete}
            disabled={!acknowledged}
            className={`w-full py-3 rounded-lg font-semibold ${
              acknowledged
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Continue to Belrose
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Setup Encryption Password</h2>
          <p className="text-sm text-gray-600 mt-1">
            This password encrypts your health records. It's separate from your login password.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Important</p>
              <p>
                If you forget this password, your records cannot be recovered by Belrose support.
                You'll need your recovery key to regain access.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Encryption Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 12 characters"
                className="w-full px-3 py-2 border rounded-lg pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Strength:</span>
                  <span className={`font-semibold ${passwordStrength.color}`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      passwordStrength.score <= 2
                        ? 'bg-red-500'
                        : passwordStrength.score === 3
                        ? 'bg-yellow-500'
                        : passwordStrength.score === 4
                        ? 'bg-blue-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-3 py-2 border rounded-lg"
            />
            {confirmPassword.length > 0 && (
              <p className={`text-sm mt-1 ${passwordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>
        </div>

        <div className="flex space-x-3 pt-4">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSetupPassword}
            disabled={!canProceed || isSubmitting}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold ${
              canProceed && !isSubmitting
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Setting up...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};