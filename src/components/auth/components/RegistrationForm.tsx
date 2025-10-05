// /features/Auth/components/RegistrationForm.tsx

import React, { useState } from 'react';
import { Check, Lock, Wallet, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

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
      description: 'Set up your basic account information to get started',
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
      title: 'Wallet Connection',
      subtitle: 'Connect your blockchain wallet',
      description: 'Your health records, your control on the blockchain',
      icon: Wallet,
    },
    {
      number: 4,
      title: 'Identity Verification',
      subtitle: "Verify you're a real person",
      description: 'Protects against fraud and ensures data integrity',
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
      <div className="w-1/3 bg-primary p-12 flex flex-col justify-between">
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
                      <Check className="w-6 h-6 text-chart-3" />
                    ) : (
                      <Icon className={`w-6 h-6 ${isCurrent ? 'text-primary' : 'text-primary'}`} />
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
                    {isCurrent && <p className="text-chart-4 text-sm mt-1">{step.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Info */}
        <div className="text-secondary text-sm">
          <p>
            Step {currentStep} of {steps.length}
          </p>
          <div className="w-full bg-chart-4 rounded-full h-2 mt-2">
            <div
              className="bg-chart-3 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
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
            {currentStep === 2 && <div>Placeholder for Step 2: Encryption Set-up</div>}
            {currentStep === 3 && <div>Placeholder for Step 3: Wallet Connection</div>}
            {currentStep === 4 && <div>Placeholder for Step 4: Identity Verification</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationForm;
