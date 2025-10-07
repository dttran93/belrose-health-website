// /features/Auth/components/BelroseAccountForm.tsx

import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { authService } from '@/services/authServices';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthForm } from '../hooks/useAuthForm';
import { SocialAuthButtons } from './ui/SocialAuthButtons';
import { EncryptionPasswordSetup } from '@/features/Encryption/components/EncryptionPasswordSetup';

interface BelroseAccountFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

interface PasswordRequirements {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  symbol: boolean;
}

interface FirebaseError extends Error {
  code?: string;
}

interface BelroseAccountFormProps {
  onSwitchToLogin: () => void;
  onComplete: (data: any) => void;
  initialData?: any;
}

const getPasswordRequirements = (password: string): PasswordRequirements => {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
};

const PasswordRequirementsComponent: React.FC<{ password: string; show: boolean }> = ({
  password,
  show,
}) => {
  if (!show) return null;

  const requirements = getPasswordRequirements(password);

  const requirementItems = [
    { key: 'length', text: 'At least 8 characters', met: requirements.length },
    { key: 'uppercase', text: 'One uppercase letter (A-Z)', met: requirements.uppercase },
    { key: 'lowercase', text: 'One lowercase letter (a-z)', met: requirements.lowercase },
    { key: 'number', text: 'One number (0-9)', met: requirements.number },
    { key: 'symbol', text: 'One symbol (!@#$%^&*)', met: requirements.symbol },
  ];

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
      <p className="text-xs font-medium text-foreground mb-2">Password requirements:</p>
      <ul className="space-y-1">
        {requirementItems.map(req => (
          <li key={req.key} className="flex items-center text-xs">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${req.met ? 'bg-green-500' : 'bg-red-400'}`}
            />
            <span
              className={`${
                req.met ? 'text-green-700 line-through' : 'text-red-600 font-semibold'
              }`}
            >
              {req.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const BelroseAccountForm: React.FC<BelroseAccountFormProps> = ({ onSwitchToLogin }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { formData, errors, isLoading, setErrors, setIsLoading, handleInputChange } =
    useAuthForm<BelroseAccountFormData>({
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
    });

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState<boolean>(false);
  const [showEncryptionSetup, setShowEncryptionSetup] = useState<boolean>(false);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const requirements = getPasswordRequirements(formData.password);
      const allMet = Object.values(requirements).every(Boolean);
      if (!allMet) {
        newErrors.password = 'Password does not meet all requirements';
      }
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const user = await authService.signUp(
        trimmedEmail,
        formData.password,
        `${formData.firstName.trim()} ${formData.lastName.trim()}`
      );
      console.log('User created:', user);

      toast.success('Sign up successful!', {
        description: 'Your account has been created.',
        duration: 3000,
      });

      setShowEncryptionSetup(true);
    } catch (error) {
      console.error('Auth error:', error);
      const firebaseError = error as FirebaseError;

      let errorMessage = 'An error occurred. Please try again.';

      switch (firebaseError.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'An account with this email already exists.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Please choose a stronger password.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.';
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

  const handleEncryptionSetupComplete = (): void => {
    setShowEncryptionSetup(false);
    toast.success('Encryption enabled! Your health records are now protected.', {
      duration: 4000,
    });
    const from = location.state?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  };

  const handleSkipEncryption = (): void => {
    setShowEncryptionSetup(false);
    toast.info('You can enable encryption later in Settings', {
      duration: 4000,
    });
    const from = location.state?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  };

  return (
    <>
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* First Name field */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">First Name</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className={`w-full pl-10 pr-4 py-3 border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all ${
                errors.firstName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your first name"
            />
          </div>
          {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>}
        </div>

        {/* Last Name field */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Last Name</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className={`w-full pl-10 pr-4 py-3 border bg-background rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all ${
                errors.lastName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your last name"
            />
          </div>
          {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>}
        </div>

        {/* Email field */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
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
              onFocus={() => setShowPasswordRequirements(true)}
              onBlur={() => setShowPasswordRequirements(false)}
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

          <PasswordRequirementsComponent
            password={formData.password}
            show={showPasswordRequirements || formData.password.length > 0}
          />

          {errors.password && formData.password.length === 0 && (
            <p className="mt-1 text-sm text-red-600">{errors.password}</p>
          )}
        </div>

        {/* Confirm Password field */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Confirm Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className={`w-full pl-10 pr-4 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all ${
                errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Confirm your password"
            />
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
          )}
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
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>

      {/* Social login*/}
      <SocialAuthButtons disabled={isLoading} />

      {/* Encryption Setup Modal - shows after successful signup */}
      {showEncryptionSetup && (
        <EncryptionPasswordSetup
          onComplete={handleEncryptionSetupComplete}
          onCancel={handleSkipEncryption}
        />
      )}
    </>
  );
};

export default BelroseAccountForm;
