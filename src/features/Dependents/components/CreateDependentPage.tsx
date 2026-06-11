// src/features/Dependents/components/CreateDependentPage.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import InputField from '@/components/ui/InputField';
import { RecoveryKeyDisplay } from '@/features/Auth/components/RecoveryKeyDisplay';
import PasswordStrengthIndicator from '@/features/Auth/components/ui/PasswordStrengthIndicator';
import { useCreateDependent } from '../hooks/useCreateDependent';

const STEPS = [
  { key: 'info', label: 'Dependent Info' },
  { key: 'password', label: 'Set Password' },
  { key: 'recovery', label: 'Recovery Key' },
] as const;

export const CreateDependentPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    step,
    formData,
    updateFormData,
    isSubmitting,
    result,
    error,
    goToStep,
    createAccount,
    finish,
  } = useCreateDependent();

  const dependentDisplayName = formData.firstName || 'dependent';

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Account Created</h1>
        <p className="text-slate-500 mb-8">
          {formData.firstName}'s account is ready. You're listed as their guardian and have full
          access to manage their records.
        </p>
        <Button onClick={() => navigate('/app/settings/dependents')}>Back to Dependents</Button>
      </div>
    );
  }

  // After the early return above, step is narrowed to 'info' | 'password' | 'recovery'
  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate('/app/settings/dependents')}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Add Dependent Account</h1>
          <p className="text-sm text-slate-500">
            Create a Belrose account for someone in your care
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const isDone = i < currentStepIndex;
          const isCurrent = i === currentStepIndex;
          return (
            <React.Fragment key={s.key}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    isDone
                      ? 'bg-green-500 text-white'
                      : isCurrent
                        ? 'bg-primary text-secondary'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span
                  className={`text-sm font-medium ${isCurrent ? 'text-slate-900' : 'text-slate-400'}`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-200" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">

        {/* ── Step 1: Info ── */}
        {step === 'info' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 mb-1">
                Dependent's information
              </h2>
              <p className="text-sm text-slate-500">
                This will be the name shown on their health profile.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">First Name</label>
                <InputField
                  type="text"
                  value={formData.firstName}
                  onChange={e => updateFormData({ firstName: e.target.value })}
                  placeholder="Jane"
                  className="px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Last Name</label>
                <InputField
                  type="text"
                  value={formData.lastName}
                  onChange={e => updateFormData({ lastName: e.target.value })}
                  placeholder="Smith"
                  className="px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={formData.hasOwnEmail}
                  onChange={e => updateFormData({ hasOwnEmail: e.target.checked, email: '' })}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">
                  {dependentDisplayName} has their own email address
                </span>
              </label>

              {formData.hasOwnEmail && (
                <InputField
                  type="email"
                  value={formData.email}
                  onChange={e => updateFormData({ email: e.target.value })}
                  placeholder="jane@example.com"
                  className="px-3 py-2 text-sm"
                />
              )}

              {!formData.hasOwnEmail && (
                <p className="text-xs text-slate-400">
                  A placeholder email will be generated automatically. You can update it to a real
                  email later when{' '}
                  {formData.firstName || 'they'} is ready to manage their own account.
                </p>
              )}
            </div>

            <Button
              onClick={() => goToStep('password')}
              disabled={!formData.firstName || !formData.lastName || (formData.hasOwnEmail && !formData.email)}
              className="w-full"
            >
              Continue
            </Button>
          </div>
        )}

        {/* ── Step 2: Password ── */}
        {step === 'password' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 mb-1">
                Set a password for {formData.firstName}'s account
              </h2>
              <p className="text-sm text-slate-500">
                This password lets {formData.firstName} log in independently. Keep it somewhere safe
                — you'll need it when {formData.firstName} is ready to access their own account.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Password</label>
              <InputField
                type="password"
                value={formData.password}
                onChange={e => updateFormData({ password: e.target.value })}
                placeholder="At least 8 characters"
                className="px-3 py-2 text-sm"
              />
            </div>

            <PasswordStrengthIndicator password={formData.password} />

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Confirm Password
              </label>
              <InputField
                type="password"
                value={formData.confirmPassword}
                onChange={e => updateFormData({ confirmPassword: e.target.value })}
                placeholder="Repeat the password"
                className="px-3 py-2 text-sm"
                onKeyDown={e => e.key === 'Enter' && !isSubmitting && createAccount()}
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => goToStep('info')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={createAccount}
                disabled={isSubmitting || !formData.password || !formData.confirmPassword}
                className="flex-1"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  'Create Account'
                )}
              </Button>
            </div>

            {isSubmitting && (
              <p className="text-xs text-slate-400 text-center">
                Generating encryption keys and registering on the network — this takes a moment.
              </p>
            )}
          </div>
        )}

        {/* ── Step 3: Recovery Key ── */}
        {step === 'recovery' && result && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 mb-1">
                Save {formData.firstName}'s recovery key
              </h2>
              <p className="text-sm text-slate-500">
                This 24-word key is the only way to recover {formData.firstName}'s account if the
                password is ever lost. Store it securely — it will not be shown again.
              </p>
            </div>

            <RecoveryKeyDisplay
              recoveryKey={result.recoveryKey}
              onAcknowledge={acknowledged => updateFormData({ acknowledgedRecoveryKey: acknowledged })}
              onComplete={finish}
              isCompleted={formData.acknowledgedRecoveryKey}
              isActivated={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateDependentPage;
