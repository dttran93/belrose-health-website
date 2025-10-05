// /features/Auth/components/LoginForm.tsx

import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { authService } from '@/services/authServices';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthForm } from '../hooks/useAuthForm';
import { SocialAuthButtons } from './ui/SocialAuthButtons';
import { EncryptionPasswordPrompt } from '@/features/Encryption/components/EncryptionPasswordPrompt';
import { EncryptionSetupService } from '@/features/Encryption/services/encryptionSetupService';

interface LoginFormData {
  email: string;
  password: string;
}

interface FirebaseError extends Error {
  code?: string;
}

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { formData, errors, isLoading, setErrors, setIsLoading, handleInputChange } =
    useAuthForm<LoginFormData>({
      email: '',
      password: '',
    });

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginStep, setLoginStep] = useState<'credentials' | 'encryption'>('credentials');

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
      const user = await authService.signIn(trimmedEmail, formData.password);
      console.log('User logged in:', user);

      const encryptionMetadata = await EncryptionSetupService.getEncryptionMetadata();

      if (encryptionMetadata?.enabled) {
        setLoginStep('encryption');
      } else {
        toast.success('Login successful!', {
          description: 'Welcome back! You have logged in.',
          duration: 3000,
        });

        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error('Auth error:', error);
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

  const handleEncryptionUnlocked = () => {
    toast.success('Login successful!', {
      description: 'Welcome back!',
      duration: 3000,
    });
    const from = location.state?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  };

  if (loginStep === 'encryption') {
    return <EncryptionPasswordPrompt onUnlocked={handleEncryptionUnlocked} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-card">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-secondary" />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">Welcome Back</h1>
          <p className="text-foreground">Sign in to your account</p>
        </div>

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
                  className={`w-full pl-10 pr-12 py-3 bg-background border focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent rounded-xl ${
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
                  className={`w-full pl-10 pr-12 py-3 bg-background border focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent rounded-xl ${
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
