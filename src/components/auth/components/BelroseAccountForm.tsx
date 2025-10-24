// /features/Auth/components/BelroseAccountForm.tsx

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  Edit2,
  CheckCircle,
  UserPen,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { authService } from '@/components/auth/services/authServices';
import { useAuthForm } from '../hooks/useAuthForm';
import { SocialAuthButtons } from './ui/SocialAuthButtons';
import { PasswordStrengthIndicator } from '@/components/auth/components/ui/PasswordStrengthIndicator';
import {
  validatePassword,
  validatePasswordConfirmation,
} from '@/components/auth/utils/PasswordStrength';
import InputField from './ui/InputField';

interface BelroseAccountFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

interface FirebaseError extends Error {
  code?: string;
}

interface BelroseAccountFormProps {
  onComplete: (data: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  }) => void;
  initialData: any;
  isCompleted?: boolean;
}

const BelroseAccountForm: React.FC<BelroseAccountFormProps> = ({
  onComplete,
  initialData,
  isCompleted = false,
}) => {
  const { formData, errors, isLoading, setErrors, setIsLoading, handleInputChange, setFormData } =
    useAuthForm<BelroseAccountFormData>({
      email: initialData.email || '',
      password: '',
      confirmPassword: '',
      firstName: initialData.firstName || '',
      lastName: initialData.lastName || '',
    });

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState(!isCompleted);

  useEffect(() => {
    if (initialData.email || initialData.firstName || initialData.lastName) {
      // Check if setFormData exists in your useAuthForm hook
      // If not, we'll need to update the hook
      if (setFormData) {
        setFormData({
          email: initialData.email || '',
          password: '',
          confirmPassword: '',
          firstName: initialData.firstName || '',
          lastName: initialData.lastName || '',
        });
      }
    }
  }, [initialData.email, initialData.firstName, initialData.lastName]);

  // ========== COMPLETED VIEW ========================
  if (isCompleted && !isEditing) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Account Created</h2>
          <p className="text-gray-600 mt-2">
            This account coordinates all the tools necessary for you to own and manage your health
            data.
          </p>
        </div>

        {/* Completed Banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-900">Step Complete</p>
              <p className="text-sm text-green-700 mt-1">
                Your account information has been saved.
              </p>
            </div>
          </div>
        </div>

        {/* Summary of entered data */}
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              First Name
            </label>
            <p className="text-gray-900 font-medium mt-1">{initialData.firstName}</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Last Name
            </label>
            <p className="text-gray-900 font-medium mt-1">{initialData.lastName}</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Email
            </label>
            <p className="text-gray-900 font-medium mt-1">{initialData.email}</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              User ID
            </label>
            <p className="text-gray-900 font-mono text-sm mt-1">{initialData.userId}</p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => setIsEditing(true)}
          className="w-full flex items-center justify-center space-x-2"
        >
          <Edit2 className="w-4 h-4" />
          <span>Edit Information</span>
        </Button>
      </div>
    );
  }

  // =============== NORMAL FORM VIEW (EDITING OR NOT YET COMPLETED) =================
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

    if (!isCompleted) {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else {
        const passwordValidation = validatePassword(formData.password, 8, 3);
        if (!passwordValidation.valid) {
          newErrors.password = passwordValidation.error || 'Password does not meet requirements';
        }
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) return;

    if (isCompleted && isEditing) {
      onComplete({
        userId: initialData.userId, // Keep the same userId
        email: formData.email.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
      });
      setIsEditing(false);
      toast.success('Information updated successfully');
      return;
    }

    // Normal Sign-up Flow
    setIsLoading(true);
    const trimmedEmail = formData.email.trim();

    try {
      const user = await authService.signUp(
        trimmedEmail,
        formData.password,
        `${formData.firstName.trim()} ${formData.lastName.trim()}`
      );
      console.log('User created:', user);

      onComplete({
        userId: user.uid, // ← This is the Firebase user ID
        email: trimmedEmail,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
      });
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

  return (
    <>
      {/* Show editing banner if in edit mode */}
      {isCompleted && isEditing && (
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Edit2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900">Editing Account Information</p>
              <p className="text-sm text-blue-700 mt-1">
                Make your changes and click "Submit" when done.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {!isCompleted && (
          <>
            {/* Header */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
                <UserPen className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Create Belrose Account</h2>
              <p className="text-gray-600 mt-2">
                This account coordinates all the tools necessary for you to own and manage your
                health data.
              </p>
            </div>
          </>
        )}

        {/* First Name field */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">First Name</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <InputField
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className={`w-full rounded-xl transition-all ${
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
            <InputField
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className={`w-full rounded-xl transition-all ${
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
            <InputField
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`w-full rounded-xl transition-all ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your email"
            />
          </div>
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>

        {!isCompleted && (
          <>
            {/* Password field */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <InputField
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`w-full rounded-xl transition-all ${
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

              <PasswordStrengthIndicator password={formData.password} showFeedback={true} />

              {errors.password && formData.password.length === 0 && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password field */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <InputField
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`w-full rounded-xl transition-all ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Confirm your password"
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>
          </>
        )}

        {/* Submit error */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* Submit button */}
        <Button type="submit" disabled={isLoading} size="lg" className="w-full rounded-xl">
          Submit
        </Button>

        {/* Cancel button when editing */}
        {isEditing && isCompleted && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsEditing(false);
              // Reset form data to initial values
              handleInputChange({
                target: { name: 'firstName', value: initialData.firstName },
              } as any);
              handleInputChange({
                target: { name: 'lastName', value: initialData.lastName },
              } as any);
              handleInputChange({ target: { name: 'email', value: initialData.email } } as any);
            }}
            className="w-full rounded-xl"
          >
            Cancel
          </Button>
        )}
      </form>

      {/* Social login*/}
      {!isCompleted && <SocialAuthButtons disabled={isLoading} />}
    </>
  );
};

export default BelroseAccountForm;
