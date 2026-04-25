// /features/Auth/components/VerificationHub.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, CheckCircle2, ArrowRight, Clock, Lock, RefreshCw, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { VerificationResult, VerifiedData } from '@/features/IdentityVerification/identity.types';
import { getAuth, sendEmailVerification } from 'firebase/auth';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { authService } from '@/features/Auth/services/authServices';
import IdentityVerificationCard from '@/features/IdentityVerification/components/IdentityVerificationCard';
import IDswyftAdapter from '@/features/IdentityVerification/adapters/IDswyftAdapter';
import IdentityVerification from '@/features/IdentityVerification/components/IdentityVerification';

interface VerificationHubProps {
  userId?: string;
  email?: string;
}

const VerificationHub: React.FC<VerificationHubProps> = ({
  userId: propUserId,
  email: propEmail,
}) => {
  const { refreshUser } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const db = getFirestore();

  // Get data from props or location state
  const userId = propUserId || location.state?.user || auth.currentUser?.uid;
  const email = propEmail || location.state?.email || auth.currentUser?.email;
  const fromRegistration = location.state?.fromRegistration || false;

  // If no user is logged in, redirect to auth
  useEffect(() => {
    if (!auth.currentUser) {
      navigate('/auth', { replace: true });
    }
  }, [auth.currentUser, navigate]);

  // Don't render anything while redirecting
  if (!auth.currentUser) {
    return null;
  }

  // Verification states
  const [emailVerified, setEmailVerified] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [identityStatus, setIdentityStatus] = useState<
    'unverified' | 'pending_manual_review' | 'verified'
  >('unverified');
  const [verifiedData, setVerifiedData] = useState<VerifiedData | null>(null);
  const [activeFlow, setActiveFlow] = useState<'hub' | 'identity'>('hub');

  // Loading/error states
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [emailCheckAttempts, setEmailCheckAttempts] = useState(0);
  const [lastResendTime, setLastResendTime] = useState<number | null>(null);

  // Check initial email verification status
  useEffect(() => {
    checkEmailVerification();
  }, []);

  const checkEmailVerification = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await currentUser.reload();
      setEmailVerified(currentUser.emailVerified);
    }
  };

  const handleEmailVerificationCheck = async () => {
    setIsCheckingEmail(true);
    try {
      // This now forces the whole app to see the updated emailVerified status
      await refreshUser();

      // Check the local auth instance for the UI logic
      const currentUser = authService.getCurrentUser();
      if (currentUser?.emailVerified) {
        setEmailVerified(true);

        // Update Firestore so the database reflects the verification too
        if (userId) {
          const userDocRef = doc(db, 'users', userId);
          await updateDoc(userDocRef, {
            emailVerified: true,
            emailVerifiedAt: new Date().toISOString(),
          });
        }

        toast.success('Email verified!');
      } else {
        toast.error('Not verified yet', { description: 'Please check your email link.' });
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    // Rate limit: 60 seconds between resends
    if (lastResendTime && Date.now() - lastResendTime < 60000) {
      const secondsLeft = Math.ceil((60000 - (Date.now() - lastResendTime)) / 1000);
      toast.error(`Please wait ${secondsLeft} seconds before resending`);
      return;
    }

    setIsResendingEmail(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await sendEmailVerification(currentUser);
        setLastResendTime(Date.now());
        toast.success('Verification email sent!', {
          description: `Check your inbox at ${email}`,
        });
      }
    } catch (error: any) {
      console.error('Error resending verification email:', error);
      if (error.code === 'auth/too-many-requests') {
        toast.error('Too many requests', {
          description: 'Please wait a few minutes before trying again',
        });
      } else {
        toast.error('Failed to resend email');
      }
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleIdentityVerificationSuccess = async (result: VerificationResult) => {
    const isPendingReview = result.reason === 'pending_manual_review';

    if (userId) {
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        identityVerified: result.verified, // true only if fully verified
        identityVerificationStatus: isPendingReview // new field
          ? 'pending_manual_review'
          : result.verified
            ? 'verified'
            : 'failed',
        identityVerifiedAt: result.verified ? new Date().toISOString() : null,
      });
    }

    if (result.verified) {
      await writeVerificationToBlockchain(emailVerified, true);
    }

    setIdentityStatus(
      result.verified
        ? 'verified'
        : result.reason === 'pending_manual_review'
          ? 'pending_manual_review'
          : 'unverified'
    );
    setVerifiedData(result.data ?? null);
    setIdentityVerified(result.verified);
    setActiveFlow('hub');

    toast.success(result.verified ? 'Identity verified!' : 'Documents submitted for review', {
      description: result.verified
        ? emailVerified
          ? 'Your network status has been upgraded to Verified'
          : 'Complete email verification to unlock full Verified status'
        : "We'll notify you by email once your identity has been confirmed.",
    });
  };

  const handleIdentityVerificationError = (error: Error) => {
    console.error('Identity verification failed:', error);
    toast.error(`Verification failed: ${error.message}`);
  };

  // Only allow skipping IDENTITY verification, not email
  const handleContinueToApp = async () => {
    await auth.currentUser?.reload();
    if (!auth.currentUser?.emailVerified) {
      toast.error('Email verification required', {
        description: 'Please verify your email before continuing',
      });
      setEmailVerified(false);
      return;
    }

    if (!identityVerified) {
      toast.info('You can complete identity verification anytime from Account Settings');
    }

    navigate('/app', { replace: true });
  };

  const writeVerificationToBlockchain = async (
    isEmailVerified: boolean,
    isIdentityVerified: boolean
  ) => {
    // Only update Verification status if both email AND identity are verified
    if (!isEmailVerified || !isIdentityVerified) {
      console.log('ℹ️ Both verifications required for blockchain update', {
        emailVerified: isEmailVerified,
        identityVerified: isIdentityVerified,
      });
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();
      const walletAddress = userData?.wallet?.address;

      if (walletAddress) {
        const functions = getFunctions();
        const updateStatus = httpsCallable(functions, 'updateMemberStatus');
        await updateStatus({ walletAddress, status: 2 }); // 2 = Verified
        console.log('✅ Blockchain status updated to Verified');
      } else {
        console.warn('⚠️ No wallet address found, skipping blockchain update');
      }
    } catch (error) {
      console.error('⚠️ Blockchain update failed:', error);
    }
  };

  // Calculate if user can proceed (email verified = minimum requirement)
  const canProceed = emailVerified;

  return (
    <div className="min-h-screen bg-secondary from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">
            {fromRegistration ? 'Account Created!' : 'Verify Your Account'}
          </h1>
          <p className="text-muted-foreground text-lg">
            {fromRegistration
              ? 'Complete email verification to access your account'
              : 'Verify your account to unlock all features'}
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          {/* Identity Verification Adapter and Form */}
          {activeFlow === 'identity' ? (
            <>
              <button
                onClick={() => setActiveFlow('hub')}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to verification
              </button>
              <IdentityVerification
                userId={userId}
                onSuccess={result => {
                  handleIdentityVerificationSuccess(result);
                  setActiveFlow('hub');
                }}
                onError={error => {
                  handleIdentityVerificationError(error);
                  setActiveFlow('hub');
                }}
                onBack={() => setActiveFlow('hub')}
              />
            </>
          ) : (
            <div className="space-y-6">
              {/* Email Verification Card - REQUIRED */}
              <div
                className={`border-2 rounded-xl p-6 transition-all ${
                  emailVerified
                    ? 'border-complement-3 bg-complement-3/5'
                    : 'border-destructive bg-destructive/5'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                        emailVerified ? 'bg-complement-3' : 'bg-destructive'
                      }`}
                    >
                      {emailVerified ? (
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      ) : (
                        <Mail className="w-6 h-6 text-white" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-semibold text-primary">Email Verification</h3>
                        {!emailVerified && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-destructive text-white rounded">
                            REQUIRED
                          </span>
                        )}
                        {emailVerified && (
                          <span className="text-sm text-complement-3 font-medium">✓ Verified</span>
                        )}
                      </div>

                      {!emailVerified && (
                        <>
                          <p className="text-muted-foreground mb-4">
                            We've sent a verification link to{' '}
                            <span className="font-medium text-primary">{email}</span>. Check your
                            inbox and click the link to verify.
                          </p>

                          {/* Why it's required */}
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                            <div className="flex items-start space-x-2">
                              <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <p className="text-sm text-amber-800">
                                Email verification is required to share records, recover your
                                account, and receive important security notifications.
                              </p>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center justify-center">
                            <div className="flex gap-3">
                              <Button
                                onClick={handleEmailVerificationCheck}
                                disabled={isCheckingEmail}
                                variant="default"
                              >
                                {isCheckingEmail ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Checking...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    I've Verified My Email
                                  </>
                                )}
                              </Button>

                              <Button
                                onClick={handleResendVerificationEmail}
                                disabled={isResendingEmail}
                                variant="outline"
                              >
                                {isResendingEmail ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <Mail className="w-4 h-4 mr-2" />
                                    Resend Email
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Help text after multiple attempts */}
                          {emailCheckAttempts >= 2 && (
                            <p className="text-sm text-muted-foreground mt-3">
                              <Clock className="w-3 h-3 inline mr-1" />
                              Can't find it? Check your spam folder or try resending.
                            </p>
                          )}
                        </>
                      )}

                      {emailVerified && (
                        <p className="text-muted-foreground">
                          Your email has been successfully verified. You can now share records and
                          recover your account.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Identity Verification Section */}
              <IdentityVerificationCard
                emailVerified={emailVerified}
                status={identityStatus}
                verifiedData={verifiedData}
                onStart={() => setActiveFlow('identity')}
              />

              {/* Action Buttons */}
              <div className="flex items-center justify-end pt-6 border-t">
                <div className="flex items-center space-x-2">
                  {(emailVerified || identityVerified) && (
                    <div className="text-sm text-muted-foreground mr-2">
                      {emailVerified && identityVerified
                        ? '🎉 Fully verified!'
                        : emailVerified
                          ? '✓ Email verified'
                          : ''}
                    </div>
                  )}
                  <Button
                    onClick={handleContinueToApp}
                    className="flex items-center space-x-2"
                    disabled={!canProceed}
                    variant={canProceed ? 'default' : 'outline'}
                  >
                    <span>{canProceed ? 'Continue to App' : 'Verify Email to Continue'}</span>
                    {canProceed && <ArrowRight className="w-5 h-5" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Note - Updated messaging */}
        <div className="text-center mt-3">
          <p className="text-sm text-muted-foreground">
            {!emailVerified ? (
              <>
                Email verification is required to use Belrose. Having trouble?{' '}
                <button
                  type="button"
                  onClick={handleResendVerificationEmail}
                  className="text-primary font-medium hover:underline"
                >
                  Resend verification email
                </button>
              </>
            ) : !identityVerified && activeFlow !== 'identity' ? (
              <>
                Identity verification is optional but unlocks important features. You can complete
                it anytime from{' '}
                <span className="text-primary font-medium">Account Settings → Verification</span>.
              </>
            ) : activeFlow === 'identity' ? (
              <></>
            ) : (
              <>Your account is fully verified. You have access to all Belrose features.</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerificationHub;
