// src/features/Dependents/hooks/useCreateDependent.ts

import { useState } from 'react';
import { toast } from 'sonner';
import {
  DependentAccountService,
  generatePlaceholderEmail,
  type CreateDependentAccountResult,
} from '../services/dependentAccountService';

export type CreateDependentStep = 'info' | 'password' | 'recovery' | 'done';

export interface DependentFormData {
  firstName: string;
  lastName: string;
  // Password the guardian sets for the dependent's independent login / future handoff.
  // Not used for guardian account switching — that will use custom token sessions in V2.
  password: string;
  confirmPassword: string;
  acknowledgedRecoveryKey: boolean;
}

const initialFormData: DependentFormData = {
  firstName: '',
  lastName: '',
  password: '',
  confirmPassword: '',
  acknowledgedRecoveryKey: false,
};

export function useCreateDependent() {
  const [step, setStep] = useState<CreateDependentStep>('info');
  const [formData, setFormData] = useState<DependentFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<CreateDependentAccountResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateFormData(updates: Partial<DependentFormData>) {
    setFormData(prev => ({ ...prev, ...updates }));
  }

  function goToStep(next: CreateDependentStep) {
    setError(null);
    setStep(next);
  }

  async function createAccount() {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const email = generatePlaceholderEmail();

      const accountResult = await DependentAccountService.createAccount({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email,
        password: formData.password,
      });

      setResult(accountResult);
      goToStep('recovery');
    } catch (err: any) {
      const message =
        err?.code === 'functions/already-exists'
          ? 'An account with this email already exists'
          : err?.message || 'Failed to create account. Please try again.';
      setError(message);
      toast.error('Failed to create dependent account');
    } finally {
      setIsSubmitting(false);
    }
  }

  function finish() {
    setStep('done');
  }

  function reset() {
    setStep('info');
    setFormData(initialFormData);
    setResult(null);
    setError(null);
    setIsSubmitting(false);
  }

  return {
    step,
    formData,
    updateFormData,
    isSubmitting,
    result,
    error,
    goToStep,
    createAccount,
    finish,
    reset,
  };
}
