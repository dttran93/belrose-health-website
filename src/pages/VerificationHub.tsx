// /features/Auth/components/VerificationHub.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail,
  IdCard,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Shield,
  Users,
  FileText,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { EmailVerificationBanner } from '../components/auth/components/EmailVerificationBanner';
import IdentityVerificationForm from '../components/auth/components/IdentityVerificationForm';
import { VerificationResult, VerifiedData } from '@/types/identity';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

interface VerificationHubProps {
  // Optional: can be passed directly or retrieved from location state
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
  const userId = propUserId || location.state?.userId;
  const email = propEmail || location.state?.email;
  const fromRegistration = location.state?.fromRegistration || false;

  const [emailVerified, setEmailVerified] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [verifiedData, setVerifiedData] = useState<VerifiedData | null>(null);
  const [showIdentityForm, setShowIdentityForm] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

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
    await checkEmailVerification();

    const currentUser = auth.currentUser;
    if (currentUser?.emailVerified) {
      toast.success('Email verified!', {
        description: 'Your email has been successfully verified',
      });

      // Update Firestore
      if (userId) {
        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, {
          isEmailVerified: true,
        });
      }
    } else {
      toast.error('Email not verified yet', {
        description: 'Please check your inbox and click the verification link',
      });
    }
    setIsCheckingEmail(false);
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
        isIdentityVerified: true,
        verifiedData: result.data,
      });
    }

    toast.success('Identity verified!', {
      description: 'You now have a higher trust score for shared records',
    });
  };

  const handleIdentityVerificationError = (error: Error) => {
    console.error('Identity verification failed:', error);
    toast.error(`Verification failed: ${error.message}`);
  };

  const handleSkipForNow = () => {
    navigate('/dashboard', { replace: true });
  };

  const handleContinueToDashboard = () => {
    if (emailVerified && identityVerified) {
      toast.success('All set!', {
        description: 'Welcome to Belrose - your account is fully verified',
      });
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-secondary from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-chart-3 rounded-full mb-4">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">
            {fromRegistration ? 'Account Created!' : 'Verify Your Account'}
          </h1>
          <p className="text-muted-foreground text-lg">
            {fromRegistration
              ? 'Complete verification to unlock all features'
              : 'Enhance your account security and trustworthiness'}
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {!showIdentityForm ? (
            <>
              {/* Verification Cards */}
              <div className="space-y-6 mb-8">
                {/* Email Verification Card */}
                <div
                  className={`border-2 rounded-xl p-6 transition-all ${
                    emailVerified
                      ? 'border-chart-3 bg-chart-3/5'
                      : 'border-gray-200 hover:border-chart-4'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                          emailVerified ? 'bg-chart-3' : 'bg-chart-4'
                        }`}
                      >
                        {emailVerified ? (
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        ) : (
                          <Mail className="w-6 h-6 text-white" />
                        )}
                      </div>

                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-primary mb-2">
                          Email Verification
                          {emailVerified && (
                            <span className="ml-2 text-sm text-chart-3 font-normal">
                              ✓ Verified
                            </span>
                          )}
                        </h3>

                        {!emailVerified && (
                          <>
                            <p className="text-muted-foreground mb-4">
                              We've sent a verification link to{' '}
                              <span className="font-medium">{email}</span>. Check your inbox and
                              click the verification link.
                            </p>

                            {/* Benefits list */}
                            <div className="space-y-2 mb-4">
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Users className="w-4 h-4 mr-2 text-chart-4" />
                                <span>Share records with verified providers</span>
                              </div>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Shield className="w-4 h-4 mr-2 text-chart-4" />
                                <span>Enable account recovery</span>
                              </div>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <AlertCircle className="w-4 h-4 mr-2 text-chart-4" />
                                <span>Receive security notifications</span>
                              </div>
                            </div>

                            <EmailVerificationBanner
                              isVerified={emailVerified}
                              isChecking={isCheckingEmail}
                              onCheckVerification={handleEmailVerificationCheck}
                            />
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

                {/* Identity Verification Card */}
                <div
                  className={`border-2 rounded-xl p-6 transition-all ${
                    identityVerified
                      ? 'border-chart-3 bg-chart-3/5'
                      : 'border-gray-200 hover:border-chart-4'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                          identityVerified ? 'bg-chart-3' : 'bg-chart-4'
                        }`}
                      >
                        {identityVerified ? (
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        ) : (
                          <IdCard className="w-6 h-6 text-white" />
                        )}
                      </div>

                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-primary mb-2">
                          Identity Verification
                          {identityVerified && (
                            <span className="ml-2 text-sm text-chart-3 font-normal">
                              ✓ Verified
                            </span>
                          )}
                        </h3>

                        {!identityVerified && (
                          <>
                            <p className="text-muted-foreground mb-4">
                              Verify your identity to unlock premium features
                            </p>

                            {/* Benefits list */}
                            <div className="space-y-2 mb-4">
                              <div className="flex items-center text-sm text-muted-foreground">
                                <FileText className="w-4 h-4 mr-2 text-chart-4" />
                                <span>Request medical records on your behalf</span>
                              </div>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Sparkles className="w-4 h-4 mr-2 text-chart-4" />
                                <span>Higher trust score for shared records</span>
                              </div>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Shield className="w-4 h-4 mr-2 text-chart-4" />
                                <span>Enhanced security verification</span>
                              </div>
                            </div>

                            <Button onClick={() => setShowIdentityForm(true)} variant="default">
                              Start Identity Verification
                            </Button>
                          </>
                        )}

                        {identityVerified && verifiedData && (
                          <p className="text-muted-foreground">
                            Identity verified as {verifiedData.firstName} {verifiedData.lastName}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t">
                <Button variant="outline" onClick={handleSkipForNow}>
                  Skip for Now
                </Button>

                <div className="flex items-center space-x-2">
                  {(emailVerified || identityVerified) && (
                    <div className="text-sm text-muted-foreground mr-2">
                      {emailVerified && identityVerified
                        ? '🎉 Fully verified!'
                        : `${emailVerified ? 'Email' : 'Identity'} verified`}
                    </div>
                  )}
                  <Button
                    onClick={handleContinueToDashboard}
                    className="flex items-center space-x-2"
                  >
                    <span>Continue to Dashboard</span>
                    <ArrowRight className="w-5 h-5" />
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

        {/* Footer Note */}
        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            You can always complete verification later from your account settings
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerificationHub;
