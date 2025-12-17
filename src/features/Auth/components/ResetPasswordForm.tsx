// src/components/auth/components/ResetPasswordForm.tsx

import React, { useState } from 'react';
import { Mail, ArrowLeft, AlertCircle, KeyRound, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authService } from '@/features/Auth/services/authServices';
import { toast } from 'sonner';

interface ResetPasswordFormProps {
  onBackToLogin: () => void;
  onSwitchToRecovery: () => void;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  onBackToLogin,
  onSwitchToRecovery,
}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword(email);
      setEmailSent(true);
      toast.success('Password reset email sent!', {
        description: 'Check your inbox for instructions',
      });
    } catch (err) {
      console.error('Password reset error:', err);
      setError('Failed to send reset email. Please try again.');
      toast.error('Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-card">
        <div className="w-full max-w-md">
          <div className="bg-background rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold text-primary mb-2">Check Your Email</h1>
            <p className="text-foreground mb-6">
              We've sent password reset instructions to <strong>{email}</strong>
            </p>

            {/* Important Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-900">
                  <p className="font-semibold mb-2">Important: About Your Encrypted Data</p>
                  <p>
                    Resetting your Firebase password will let you access your Belrose account, but{' '}
                    <strong>you'll need your 24-word recovery key</strong> to decrypt your health
                    records.
                  </p>
                  <p className="mt-2">
                    If you don't have your recovery key, your encrypted data cannot be recovered.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button onClick={onBackToLogin} className="w-full">
                Return to Login
              </Button>

              <Button onClick={onSwitchToRecovery} variant="outline" className="w-full">
                <KeyRound className="w-4 h-4 mr-2" />I Have My Recovery Key
              </Button>
            </div>

            <p className="text-sm text-gray-600 mt-4">
              Didn't receive the email? Check your spam folder or{' '}
              <button onClick={() => setEmailSent(false)} className="text-primary hover:underline">
                try again
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-secondary" />
        </div>
        <h1 className="text-3xl font-bold text-primary mb-2">Reset Password</h1>
      </div>

      {/* Warning Box */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="bg-transparent rounded p-4 mb-2">
          <p className="text-sm font-bold mb-2 text-red-600">
            ⚠️ WARNING: Your encrypted data will be permanently lost
          </p>
          <p className="text-xs">
            There is NO way to recover your encrypted data without your recovery key. This is by
            design for security - even Belrose staff cannot decrypt your data.
          </p>
          <p className="text-xs m-2">
            You CAN reset your password via email, and set up a new encryption and recovery key to
            add new records. But the old data is gone.
          </p>
        </div>

        <div className="bg-white border border-red-300 rounded p-3 mb-4">
          <p className="text-xs font-semibold mb-2">
            Not sure where your recovery key is? Please check:
          </p>
          <div className="space-y-1 text-xs">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Password manager (1Password, Bitwarden, etc.)
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Notes and saved documents/files (look for "belrose-recovery-key")
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Emails and screenshots
            </label>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={`w-full pl-10 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="your@email.com"
              disabled={isLoading}
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        <Button
          variant="destructive"
          type="submit"
          disabled={isLoading}
          size="lg"
          className="w-full"
        >
          {isLoading ? 'Sending...' : 'Send Reset Instructions (I Understand Data Will Be Lost)'}
        </Button>
      </form>

      {/* Alternative Option */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-center text-sm text-gray-600 mb-3">Have your recovery key instead?</p>
        <Button onClick={onSwitchToRecovery} variant="outline" className="w-full">
          <KeyRound className="w-4 h-4 mr-2" />
          Use Recovery Key
        </Button>
      </div>
    </div>
  );
};

export default ResetPasswordForm;
