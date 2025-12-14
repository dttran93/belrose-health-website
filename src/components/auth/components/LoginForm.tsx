// /features/Auth/components/LoginForm.tsx

import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, User, CheckCircle, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { authService } from '@/components/auth/services/authServices';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthForm } from '../hooks/useAuthForm';
import { SocialAuthButtons } from './ui/SocialAuthButtons';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

interface LoginFormData {
  email: string;
  password: string;
}

interface FirebaseError extends Error {
  code?: string;
}

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onForgotPassword: () => void;
  onBack: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister, onForgotPassword, onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { formData, errors, isLoading, setErrors, setIsLoading, handleInputChange } =
    useAuthForm<LoginFormData>({
      email: '',
      password: '',
    });

  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Check if user came from email verification
  const emailVerified = location.state?.emailVerified;
  const verificationMessage = location.state?.message;
  const [showBanner, setShowBanner] = useState<boolean>(!!emailVerified);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    const trimmedEmail = formData.email.trim();

    try {
      // 1. Sign in with Firebase
      const user = await authService.signIn(trimmedEmail, formData.password);
      console.log('✅ Firebase authentication successful:', user.uid);

      // 2. Get user's encrypted master key from Firestore
      const db = getFirestore();
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error('User data not found');
      }

      const userData = userDoc.data();
      console.log('📄 User data retrieved');

      // 3. Check if user has encryption set up
      if (
        userData.encryption.encryptedMasterKey &&
        userData.encryption.masterKeyIV &&
        userData.encryption.masterKeySalt
      ) {
        console.log('🔐 Initializing encryption session...');

        // 4. Unwrap the master encryption key using the login password
        await EncryptionKeyManager.initializeSessionWithPassword(
          userData.encryption.encryptedMasterKey,
          userData.encryption.masterKeyIV,
          formData.password,
          userData.encryption.masterKeySalt
        );

        console.log('✅ Encryption session initialized successfully');
      } else {
        console.warn('⚠️ User does not have encryption set up');
      }

      // 5. Success! Navigate to dashboard
      toast.success('Login successful!', {
        description: 'Welcome back!',
        duration: 3000,
      });

      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      console.error('❌ Login error:', error);
      const firebaseError = error as FirebaseError;

      let errorMessage = 'An error occurred. Please try again.';

      switch (firebaseError.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Invalid email or password.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
        default:
          errorMessage = firebaseError.message || errorMessage;
      }

      setErrors({ submit: errorMessage });

      toast.error('Authentication failed', {
        description: errorMessage,
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-card">
      <div className="w-full max-w-md">
        {/* Email Verification Success Banner */}
        {showBanner && (
          <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-in zoom-in duration-500 delay-200">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-green-900 font-semibold text-sm mb-1">
                    Email Verified Successfully!
                  </h3>
                  <p className="text-green-700 text-sm">
                    {verificationMessage ||
                      'Your email has been verified. Sign in to continue to your dashboard.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBanner(false)}
                className="flex-shrink-0 text-green-600 hover:text-green-800 transition-colors ml-2"
                aria-label="Close banner"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-secondary" />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">Welcome Back</h1>
          <p className="text-foreground">Sign in to your account</p>
        </div>

        {/* Back to Login Button */}
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-foreground hover:text-primary mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Homepage</span>
        </button>

        {/* Form */}
        <div className="bg-background rounded-2xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email field */}
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
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-12 py-3 bg-background border focus:outline-none focus:ring-1 focus:ring-chart-1 focus:border-none rounded-xl ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>

            {/* Password field */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-12 py-3 bg-background border focus:outline-none focus:ring-1 focus:ring-chart-1 focus:border-none rounded-xl ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {/* Forgot Password Link */}
              <div className="mt-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
            </div>

            {/* Submit error */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              disabled={isLoading}
              size="lg"
              className="w-full py-3 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Toggle between login/signup */}
          <div className="mt-6 text-center">
            <p className="text-foreground">
              Don't have an account?
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="ml-2 text-destructive font-medium hover:underline transition-colors"
              >
                Sign up
              </button>
            </p>
          </div>

          {/* Social login */}
          <SocialAuthButtons disabled={isLoading} />
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
