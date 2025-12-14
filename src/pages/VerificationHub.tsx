// /features/Auth/components/VerificationHub.tsx
// Updated with tiered verification: Email = Required, Identity = Optional but incentivized

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail,
  IdCard,
  CheckCircle2,
  ArrowRight,
  Shield,
  Users,
  FileText,
  Sparkles,
  ArrowLeft,
  Clock,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import IdentityVerificationForm from '../components/auth/components/IdentityVerificationForm';
import { VerificationResult, VerifiedData } from '@/types/identity';
import { getAuth, sendEmailVerification } from 'firebase/auth';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface VerificationHubProps {
  userId?: string;
  email?: string;
}

const VerificationHub: React.FC<VerificationHubProps> = ({
  userId: propUserId,
  email: propEmail,
}) => {
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
  const [verifiedData, setVerifiedData] = useState<VerifiedData | null>(null);
  const [showIdentityForm, setShowIdentityForm] = useState(false);

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
    setEmailCheckAttempts(prev => prev + 1);

    try {
      await checkEmailVerification();
      const currentUser = auth.currentUser;

      if (currentUser?.emailVerified) {
        setEmailVerified(true);

        // Update Firestore
        if (userId) {
          const userDocRef = doc(db, 'users', userId);
          await updateDoc(userDocRef, {
            emailVerified: true,
            emailVerifiedAt: new Date().toISOString(),
          });

          await writeVerificationToBlockchain(true, identityVerified);
          toast.success('Email verified!', {
            description: 'Your email has been successfully verified',
          });
        }
      } else {
        // Show helpful message based on attempt count
        if (emailCheckAttempts >= 2) {
          toast.error('Still not verified', {
            description:
              "Check your spam folder, or click 'Resend' to get a new verification email",
          });
        } else {
          toast.error('Email not verified yet', {
            description: 'Please check your inbox and click the verification link',
          });
        }
      }
    } catch (error) {
      console.error('Error checking email verification:', error);
      toast.error('Failed to check verification status');
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
    console.log('Identity verification successful!', result);
    setVerifiedData(result.data ?? null);
    setIdentityVerified(true);
    setShowIdentityForm(false);

    // Update Firestore
    if (userId) {
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        identityVerified: true,
        verifiedData: result.data,
        identityVerifiedAt: new Date().toISOString(),
      });
    }

    await writeVerificationToBlockchain(emailVerified, true);

    toast.success('Identity verified!', {
      description: emailVerified
        ? 'Your blockchain trust score has been upgraded to Verified status'
        : 'Complete email verification to unlock full Verified status',
    });
  };

  const handleIdentityVerificationError = (error: Error) => {
    console.error('Identity verification failed:', error);
    toast.error(`Verification failed: ${error.message}`);
  };

  // Only allow skipping IDENTITY verification, not email
  const handleSkipIdentityVerification = () => {
    if (!emailVerified) {
      toast.error('Email verification required', {
        description: 'Please verify your email before continuing',
      });
      return;
    }

    toast.info('Identity verification skipped', {
      description: 'You can complete this later in Account Settings',
    });
    navigate('/dashboard', { replace: true });
  };

  const handleContinueToDashboard = () => {
    if (!emailVerified) {
      toast.error('Email verification required', {
        description: 'Please verify your email before continuing',
      });
      return;
    }

    if (emailVerified && identityVerified) {
      toast.success('All set!', {
        description: 'Welcome to Belrose - your account is fully verified',
      });
    } else {
      toast.success('Welcome to Belrose!', {
        description: 'Complete identity verification anytime for enhanced features',
      });
    }
    navigate('/dashboard', { replace: true });
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
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {!showIdentityForm ? (
            <>
              {/* Verification Cards */}
              <div className="space-y-6 mb-8">
                {/* Email Verification Card - REQUIRED */}
                <div
                  className={`border-2 rounded-xl p-6 transition-all ${
                    emailVerified
                      ? 'border-chart-3 bg-chart-3/5'
                      : 'border-destructive bg-destructive/5'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                          emailVerified ? 'bg-chart-3' : 'bg-destructive'
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
                            <span className="text-sm text-chart-3 font-medium">✓ Verified</span>
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

                {/* Identity Verification Card - OPTIONAL */}
                <div
                  className={`border-2 rounded-xl p-6 transition-all ${
                    identityVerified
                      ? 'border-chart-3 bg-chart-3/5'
                      : emailVerified
                        ? 'border-gray-200 hover:border-chart-4'
                        : 'border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                          identityVerified
                            ? 'bg-chart-3'
                            : emailVerified
                              ? 'bg-chart-4'
                              : 'bg-gray-300'
                        }`}
                      >
                        {identityVerified ? (
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        ) : (
                          <IdCard className="w-6 h-6 text-white" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-semibold text-primary">
                            Identity Verification
                          </h3>
                          {!identityVerified && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-chart-4/20 text-chart-4 rounded">
                              RECOMMENDED
                            </span>
                          )}
                          {identityVerified && (
                            <span className="text-sm text-chart-3 font-medium">✓ Verified</span>
                          )}
                        </div>

                        {!identityVerified && (
                          <>
                            <p className="text-muted-foreground mb-4">
                              {emailVerified
                                ? 'Verify your identity to unlock important features and enhanced trust'
                                : 'Complete email verification first to enable identity verification'}
                            </p>

                            {/* Benefits - only show if email is verified */}
                            {emailVerified && (
                              <>
                                <div className="space-y-2 mb-4">
                                  <div className="flex items-center text-sm text-muted-foreground">
                                    <FileText className="w-4 h-4 mr-2 text-chart-4" />
                                    <span>Request medical records on your behalf</span>
                                  </div>
                                  <div className="flex items-center text-sm text-muted-foreground">
                                    <Sparkles className="w-4 h-4 mr-2 text-chart-4" />
                                    <span>Verified trust status</span>
                                  </div>
                                  <div className="flex items-center text-sm text-muted-foreground">
                                    <Shield className="w-4 h-4 mr-2 text-chart-4" />
                                    <span>Make attestations and dispute records</span>
                                  </div>
                                  <div className="flex items-center text-sm text-muted-foreground">
                                    <Users className="w-4 h-4 mr-2 text-chart-4" />
                                    <span>Higher credibility when sharing with providers</span>
                                  </div>
                                </div>

                                <Button
                                  onClick={() => setShowIdentityForm(true)}
                                  variant="default"
                                  disabled={!emailVerified}
                                >
                                  <IdCard className="w-4 h-4 mr-2" />
                                  Start Identity Verification
                                </Button>
                              </>
                            )}
                          </>
                        )}

                        {identityVerified && verifiedData && (
                          <div className="space-y-2">
                            <p className="text-muted-foreground">
                              Identity verified as{' '}
                              <span className="font-medium text-primary">
                                {verifiedData.firstName} {verifiedData.lastName}
                              </span>
                            </p>
                            <div className="flex items-center text-sm text-chart-3">
                              <Shield className="w-4 h-4 mr-1" />
                              <span>Blockchain status: Verified Member</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t">
                <div>
                  {emailVerified && !identityVerified && (
                    <Button variant="ghost" onClick={handleSkipIdentityVerification}>
                      Skip Identity Verification
                    </Button>
                  )}
                </div>

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
                    onClick={handleContinueToDashboard}
                    className="flex items-center space-x-2"
                    disabled={!canProceed}
                    variant={canProceed ? 'default' : 'outline'}
                  >
                    <span>{canProceed ? 'Continue to Dashboard' : 'Verify Email to Continue'}</span>
                    {canProceed && <ArrowRight className="w-5 h-5" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Identity Verification Form */}
              <div className="mb-4">
                <Button variant="ghost" onClick={() => setShowIdentityForm(false)} className="mb-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Verification Hub
                </Button>
              </div>

              <IdentityVerificationForm
                userId={userId}
                onSuccess={handleIdentityVerificationSuccess}
                onError={handleIdentityVerificationError}
                isCompleted={identityVerified}
                initialVerifiedData={verifiedData ?? undefined}
                isActivated={true}
              />
            </>
          )}
        </div>

        {/* Footer Note - Updated messaging */}
        <div className="text-center mt-6">
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
            ) : !identityVerified ? (
              <>
                Identity verification is optional but unlocks important features. You can complete
                it anytime from{' '}
                <span className="text-primary font-medium">Account Settings → Verification</span>.
              </>
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
