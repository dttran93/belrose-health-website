// src/pages/EmailVerifiedPage.tsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { CheckCircle, CircleFadingArrowUp, Lock, Share2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';

/**
 * EmailVerifiedPage Component
 *
 * This page is shown after a user successfully verifies their email.
 * It confirms verification, updates Firestore, and guides them to the dashboard.
 *
 * Key Concepts:
 * - useEffect: Runs code when component loads (like checking verification status)
 * - useState: Manages component state (loading, verified status)
 * - Firebase Auth: Checks if email is actually verified
 * - Firestore: Updates the user document to reflect verification
 */
const EmailVerifiedPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const db = getFirestore();

  // State to track if we're still checking verification
  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);

  /**
   * useEffect Hook
   * This runs once when the component first loads (the empty array [] at the end means "run once")
   * It checks if the user's email is verified and updates the database
   */
  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const currentUser = auth.currentUser;

        // If no user is signed in, they need to sign in first
        if (!currentUser) {
          toast.info('Email verified!', {
            description: 'Please sign in to access your account',
          });

          // Redirect to auth page, and after login they'll be redirected back
          navigate('/auth', {
            replace: true,
            state: {
              emailVerified: true,
              message: 'Your email has been verified! Please sign in to continue.',
            },
          });
          return;
        }

        // Reload user data from Firebase to get the latest verification status
        await currentUser.reload();

        // Check if email is actually verified
        if (currentUser.emailVerified) {
          setIsVerified(true);

          // Update Firestore to mark email as verified
          try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userDocRef, {
              emailVerified: true,
              isEmailVerified: true, // Some parts of your app use this field name
            });
          } catch (firestoreError) {
            // If Firestore update fails, it's okay - verification still worked
            console.warn('Could not update Firestore:', firestoreError);
          }

          toast.success('Email verified!', {
            description: 'Your email has been successfully verified',
          });
        } else {
          // Email not verified yet
          toast.error('Email not verified', {
            description: 'Please check your inbox and click the verification link',
          });
          setIsVerified(false);
        }
      } catch (error) {
        console.error('Error verifying email:', error);
        toast.error('Verification error', {
          description: 'There was a problem verifying your email',
        });
      } finally {
        // Stop loading spinner regardless of success or failure
        setIsLoading(false);
      }
    };

    verifyEmail();
  }, []); // Empty array means this only runs once when component mounts

  /**
   * Handle navigation to dashboard
   */
  const handleContinue = () => {
    navigate('/dashboard');
  };

  /**
   * Show loading state while checking verification
   */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center p-5">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-12 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-foreground">Verifying your email...</p>
        </div>
      </div>
    );
  }

  /**
   * Show error state if verification failed
   */
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center p-5">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-12 text-center">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-12 h-12 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-primary mb-3">Verification Failed</h1>
          <p className="text-foreground mb-6">
            We couldn't verify your email. Please try clicking the verification link again or
            request a new one.
          </p>
          <Button onClick={() => navigate('/verification')} className="w-full">
            Go to Verification Hub
          </Button>
        </div>
      </div>
    );
  }

  /**
   * Main success view
   * This is what users see when verification is successful
   */
  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-5">
      {/* Main Card - Using Tailwind's animate-in utilities */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-12 text-center animate-in fade-in slide-in-from-bottom-8 duration-500">
        {/* Success Icon with Animation - Tailwind's scale and spin animations */}
        <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-500 delay-200">
          <CheckCircle className="w-12 h-12 text-white" strokeWidth={3} />
        </div>

        {/* Title and Subtitle */}
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Email Verified!</h1>
        <p className="text-gray-600 mb-8">
          Your email has been successfully verified. You now have full access to Belrose Health.
        </p>

        {/* Feature List */}
        <div className="bg-gray-50 rounded-xl p-5 mb-8 text-left">
          {/* Feature 1: Share Records */}
          <div className="flex items-start mb-4">
            <div className="mt-1">
              <Share2 className="w-6 h-6 text-primary mr-3" />
            </div>
            <div className="flex-1">
              <strong className="block text-gray-900 text-sm mb-1">Share Health Records</strong>
              <span className="text-gray-600 text-sm">
                Securely share your records with healthcare providers, family, and anyone else you
                want
              </span>
            </div>
          </div>

          {/* Feature 2: Encryption */}
          <div className="flex items-start mb-4">
            <div className="mt-1">
              <Lock className="w-6 h-6 text-primary mr-3" />
            </div>
            <div className="flex-1">
              <strong className="block text-gray-900 text-sm mb-1">End-to-End Encryption</strong>
              <span className="text-gray-600 text-sm">
                Your data is encrypted and only you hold the keys. Even Belrose can't your data
              </span>
            </div>
          </div>

          {/* Feature 3: Credibility Score*/}
          <div className="flex items-start">
            <div className="mt-1">
              <CircleFadingArrowUp className="w-6 h-6 text-primary mr-3" />
            </div>
            <div className="flex-1">
              <strong className="block text-gray-900 text-sm mb-1">Higher Credibility</strong>
              <span className="text-gray-600 text-sm">
                Records you own or sign-off on will receive a higher credibility score
              </span>
            </div>
          </div>
        </div>

        {/* Call to Action Button */}
        <Button onClick={handleContinue} className="w-full">
          Go to Dashboard
        </Button>

        {/* Secondary Link */}
        <a
          href="/help"
          className="inline-block mt-5 text-destructive text-sm font-bold hover:underline"
        >
          Need help getting started?
        </a>
      </div>
    </div>
  );
};

export default EmailVerifiedPage;
