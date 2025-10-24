// src/components/auth/components/EmailVerificationBanner.tsx

import React, { useState, useEffect } from 'react';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authService } from '@/components/auth/services/authServices';
import { toast } from 'sonner';

interface EmailVerificationBannerProps {
  isVerified: boolean;
  isChecking: boolean;
  onCheckVerification: () => Promise<void>;
}

export const EmailVerificationBanner: React.FC<EmailVerificationBannerProps> = ({
  isVerified,
  isChecking,
  onCheckVerification,
}) => {
  const [isResending, setIsResending] = useState(false);

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      await authService.resendVerificationEmail();
      toast.success('Verification email sent!', {
        description: 'Please check your inbox and spam folder.',
      });
    } catch (error) {
      const err = error as Error;
      toast.error('Failed to send email', {
        description: err.message,
      });
    } finally {
      setIsResending(false);
    }
  };

  if (isVerified) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-green-900">Email Verified</p>
            <p className="text-sm text-green-700 mt-1">
              Your email address has been successfully verified.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 justify-center items-center">
      <Button variant="outline" size="sm" onClick={onCheckVerification} disabled={isChecking}>
        {isChecking ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Checking...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            I've Verified
          </>
        )}
      </Button>
      <Button variant="default" size="sm" onClick={handleResendEmail} disabled={isResending}>
        {isResending ? 'Sending...' : 'Resend Email'}
      </Button>
    </div>
  );
};
