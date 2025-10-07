// /features/Auth/components/RegistrationForm.tsx

import React, { useState } from 'react';
import { Check, Lock, Wallet, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';

// Import your existing components
import { useAuthForm } from '../hooks/useAuthForm';
import BelroseAccountForm from './BelroseAccountForm';
import { EncryptionPasswordSetup } from '@/features/Encryption/components/EncryptionPasswordSetup';

interface StepConfig {
  number: number;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof ShieldCheck;
}

interface RegistrationFormProps {
  onSwitchToLogin: () => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ onSwitchToLogin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Store data from all steps
  const [registrationData, setRegistrationData] = useState({
    basicInfo: {},
    encryptionPassword: '',
    walletAddress: '',
    verificationStatus: '',
  });

  const steps: StepConfig[] = [
    {
      number: 1,
      title: 'Account Creation',
      subtitle: 'Create your secure Belrose account',
      description:
        'Your Belrose account is the central hub for the encryption and blockchain transactions that will allow you to own your health data',
      icon: ShieldCheck,
    },
    {
      number: 2,
      title: 'Encryption Setup',
      subtitle: 'Protect your health records',
      description: 'Only you can access your medical data with encryption',
      icon: Lock,
    },
    {
      number: 3,
      title: 'Blockchain Connection',
      subtitle: 'Connect your blockchain wallet (optional)',
      description:
        'You control your records, but doctors may need to verify their accuracy, that is where blockchain comes in.',
      icon: Wallet,
    },
    {
      number: 4,
      title: 'Identity Verification',
      subtitle: "Verify you're a real person (optional)",
      description:
        'If you choose to verify your identity, we can go out and get your records on your behalf.',
      icon: Check,
    },
  ];

  const handleStepComplete = (stepNumber: number, data: any) => {
    // Save step data
    const dataKey =
      stepNumber === 1
        ? 'basicInfo'
        : stepNumber === 2
        ? 'encryptionPassword'
        : stepNumber === 3
        ? 'walletAddress'
        : 'verificationStatus';

    setRegistrationData(prev => ({
      ...prev,
      [dataKey]: data,
    }));

    // Move to next step or complete registration
    if (stepNumber < steps.length) {
      setCurrentStep(stepNumber + 1);
    } else {
      handleCompleteRegistration();
    }
  };

  const handleCompleteRegistration = () => {
    toast.success('Registration complete!', {
      description: 'Welcome to Belrose!',
      duration: 3000,
    });

    const from = location.state?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkipStep = () => {
    if (currentStep === 3) {
      // Wallet connection is optional
      setCurrentStep(currentStep + 1);
    }
  };

  return (
    <div className="min-h-screen bg-secondary from-blue-50 to-indigo-100 flex">
      {/* LEFT SIDE - Progress Tracker */}
      <div className="w-1/4 bg-primary p-12 flex flex-col justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary mb-2">Join Belrose</h1>
          <p className="text-secondary mb-12">Your secure health data platform</p>

          {/* Progress Steps */}
          <div className="space-y-8">
            {steps.map(step => {
              const Icon = step.icon;
              const isCompleted = step.number < currentStep;
              const isCurrent = step.number === currentStep;

              return (
                <div key={step.number} className="flex items-start space-x-4">
                  {/* Step Circle */}
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted ? 'bg-chart-3' : isCurrent ? 'bg-chart-4' : 'bg-secondary'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-6 h-6 text-primary" />
                    ) : (
                      <Icon className="w-6 h-6 text-primary" />
                    )}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1">
                    <div
                      className={`font-semibold transition-all duration-300 ${
                        isCurrent ? 'text-chart-4 text-lg' : 'text-secondary text-base'
                      }`}
                    >
                      {step.title}
                    </div>
                    {isCurrent && <p className="text-chart-4 text-sm mt-1">{step.subtitle}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Content Area */}
      <div className="flex-1 p-12 flex items-center justify-center">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {/* Render current step */}
            {currentStep === 1 && (
              <BelroseAccountForm
                onSwitchToLogin={onSwitchToLogin}
                onComplete={data => handleStepComplete(1, data)}
                initialData={registrationData.basicInfo}
              />
            )}
            {currentStep === 2 && (
              <EncryptionPasswordSetup
                onComplete={() => handleStepComplete}
                onCancel={handleBack}
              />
            )}
            {currentStep === 3 && <div>Placeholder for Step 3: Wallet Connection</div>}
            {currentStep === 4 && <div>Placeholder for Step 4: Identity Verification</div>}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-primary shadow-lg px-12 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - Step indicator and Progress Bar*/}
          <div className="flex justify-between items-center w-1/5">
            <div className="flex flex-col text-xs text-secondary flex-shrink-0 whitespace-nowrap">
              <span>Step</span>
              <span>
                {currentStep} of {steps.length}
              </span>
            </div>

            <div className="w-full bg-chart-4 rounded-full h-2 mx-3">
              <div
                className="bg-chart-3 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(currentStep / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Center Footer - Description */}
          <div className="flex">
            {steps.map(step => {
              const isCurrent = step.number === currentStep;

              return (
                <div className="flex items-start space-x-4">
                  {isCurrent && <p className="text-chart-4 text-sm mt-1">{step.description}</p>}
                </div>
              );
            })}
          </div>

          {/* Right side - Navigation buttons */}
          <div className="flex items-center space-x-4">
            <div className="flex text-white mx-3 items-center">
              <span className="text-sm">Already have an account?</span>
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="ml-2 text-destructive font-medium hover:underline transition-colors"
              >
                Sign in
              </button>
            </div>
            <Button
              onClick={() => setCurrentStep(Math.max(currentStep - 1, 1))}
              disabled={currentStep === 1}
              className="px-4 py-2 rounded-lg hover:bg-secondary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => setCurrentStep(Math.min(currentStep + 1, 4))}
              disabled={currentStep === 4}
              className="px-4 py-2 rounded-lg hover:bg-secondary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button
              variant="secondary"
              type="submit"
              className="rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <span>Create Account</span>
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RegistrationForm;
