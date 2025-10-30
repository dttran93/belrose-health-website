// src/components/auth/components/ForgotPasswordForm.tsx

import React, { useState } from 'react';
import { Mail, ArrowLeft, AlertCircle, KeyRound, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authService } from '@/components/auth/services/authServices';
import { toast } from 'sonner';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
  onSwitchToRecovery: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-card">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={onBackToLogin}
          className="flex items-center space-x-2 text-foreground hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Login</span>
        </button>

        {/* Main Card */}
        <div className="bg-background rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-secondary" />
            </div>
            <h1 className="text-3xl font-bold text-primary mb-2">Forgot Password?</h1>
            <p className="text-foreground">
              Enter your email and we'll send you reset instructions
            </p>
          </div>

          {/* Warning Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Password Disclaimer</p>
                <p className="mt-3 text-blue-800">
                  If you've forgotten your password, the only way to access your encrypted data, is
                  with your <strong>24-word recovery key</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email Address
              </label>
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

            <Button type="submit" disabled={isLoading} size="lg" className="w-full">
              {isLoading ? 'Sending...' : 'Send Reset Instructions'}
            </Button>
          </form>

          {/* Alternative Option */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600 mb-3">
              Have your recovery key instead?
            </p>
            <Button onClick={onSwitchToRecovery} variant="outline" className="w-full">
              <KeyRound className="w-4 h-4 mr-2" />
              Use Recovery Key
            </Button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Remember your password?{' '}
            <button
              onClick={onBackToLogin}
              className="text-destructive hover:underline font-medium"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;
