// src/components/auth/components/EmailVerificationBanner.tsx

import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authService } from '@/components/auth/services/authServices';
import { UserService } from '@/components/auth/services/userService';
import { toast } from 'sonner';
import { getAuth } from 'firebase/auth';

export const EmailVerificationBanner: React.FC = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    checkVerificationStatus();
  }, []);

  const checkVerificationStatus = async () => {
    setIsChecking(true);
    try {
      // Reload user to get latest status from Firebase
      await authService.reloadUser();

      const verified = authService.isEmailVerified();
      setIsVerified(verified);

      if (verified && user) {
        // Update Firestore
        await UserService.updateEmailVerificationStatus(user.uid, true);
        toast.success('Email verified successfully!');
      }
    } catch (error) {
      console.error('Error checking verification:', error);
    } finally {
      setIsChecking(false);
    }
  };

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
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <Mail className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-yellow-900">Verify Your Email</p>
          <p className="text-sm text-yellow-700 mt-1 mb-3">
            We've sent a verification email to <strong>{user?.email}</strong>. Please check your
            inbox and click the verification link.
          </p>
          <div className="flex gap-2 justify-center items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={checkVerificationStatus}
              disabled={isChecking}
              className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
            >
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleResendEmail}
              disabled={isResending}
              className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
            >
              {isResending ? 'Sending...' : 'Resend Email'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
