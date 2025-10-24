// /features/Auth/components/RegistrationForm.tsx

import React, { useState } from 'react';
import {
  Check,
  Lock,
  Wallet,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  RotateCcwKey,
} from 'lucide-react';
import { useNavigate, useLocation, data } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import BelroseAccountForm from './BelroseAccountForm';
import EncryptionPasswordSetup from './EncryptionPasswordSetup';
import { RecoveryKeyDisplay } from './RecoveryKeyDisplay';
import WalletSetup from './WalletSetup';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

interface StepConfig {
  number: number;
  title: string;
  subtitle: string;
  icon: typeof ShieldCheck;
}

interface RegistrationFormProps {
  onSwitchToLogin: () => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ onSwitchToLogin }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Store data from all steps
  const [registrationData, setRegistrationData] = useState({
    userId: '',
    email: '',
    firstName: '',
    lastName: '',
    encryptionPassword: '',
    walletAddress: '',
    walletType: '' as 'generated' | 'metamask' | undefined,
    recoveryKey: '',
    acknowledgedRecoveryKey: false,
  });

  console.log(registrationData);

  const steps: StepConfig[] = [
    {
      number: 1,
      title: 'Account Creation',
      subtitle: 'Create your secure Belrose account',
      icon: ShieldCheck,
    },
    {
      number: 2,
      title: 'Encryption Setup',
      subtitle: 'Protect your health records',
      icon: Lock,
    },
    {
      number: 3,
      title: 'Blockchain Connection',
      subtitle: 'Connect your blockchain wallet',
      icon: Wallet,
    },
    {
      number: 4,
      title: 'Recovery Key',
      subtitle: 'Save your recovery key for your encryption and blockchain wallet',
      icon: RotateCcwKey,
    },
  ];

  const isStepCompleted = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 1:
        //Step 1 is done if we have a userId and email and email verification
        return !!(registrationData.userId && registrationData.email);
      case 2:
        //Step 2 is complete if encryption password is set
        return !!registrationData.encryptionPassword;
      case 3:
        // Step 3 is complete if wallet address and type are set
        return !!(registrationData.walletAddress && registrationData.walletType);
      case 4:
        // Step 4 is completed if a recovery Key has been created/saved. Maybe change to if they've acknowledged? But I guess there's technically not a lot for them to do here...
        return !!registrationData.acknowledgedRecoveryKey;
      default:
        return false;
    }
  };

  const canCompleteRegistration = (): Boolean => {
    return isStepCompleted(1) && isStepCompleted(2) && isStepCompleted(3) && isStepCompleted(4);
  };

  const handleStepComplete = (stepNumber: number, data: any) => {
    setRegistrationData(prev => ({
      ...prev,
      ...data,
    }));

    // Move to next step
    if (stepNumber < steps.length) {
      setCurrentStep(stepNumber + 1);
    }
  };

  const handleCompleteRegistration = async () => {
    if (!canCompleteRegistration()) {
      toast.error('Please complete all steps before continuing');
      return;
    }

    try {
      // Save core account data to Firestore
      const db = getFirestore();
      const userDocRef = doc(db, 'users', registrationData.userId);

      await updateDoc(userDocRef, {
        email: registrationData.email,
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        walletAddress: registrationData.walletAddress,
        walletType: registrationData.walletType,
        // Verification fields will be updated later in the verification flow
        isEmailVerified: false,
        isIdentityVerified: false,
        createdAt: new Date(),
      });

      toast.success('Account created successfully!', {
        description: "Now let's verify your account",
        duration: 3000,
      });

      // Navigate to verification hub instead of dashboard
      navigate('/verification', {
        replace: true,
        state: {
          userId: registrationData.userId,
          email: registrationData.email,
          fromRegistration: true,
        },
      });
    } catch (error) {
      console.error('Error completing registration:', error);
      toast.error('Failed to complete registration', {
        description: 'Please try again or contact support',
        duration: 5000,
      });
    }
  };

  return (
    <div className="min-h-screen bg-secondary from-blue-50 to-indigo-100 flex">
      {/* LEFT SIDE - Progress Tracker */}
      <div className="w-1/3 2xl:w-1/4 bg-primary p-12 flex flex-col justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary mb-2">Join Belrose</h1>
          <p className="text-secondary mb-12">
            Your it takes less than minutes to create your secure health data platform
          </p>

          {/* Progress Steps */}
          <div className="space-y-8">
            {steps.map(step => {
              const Icon = step.icon;
              const isCompleted = isStepCompleted(step.number);
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
                        isCompleted
                          ? `text-chart-3`
                          : isCurrent
                          ? 'text-chart-4 text-lg'
                          : 'text-secondary text-base'
                      }`}
                    >
                      {step.title}
                    </div>
                    {isCurrent && (
                      <p
                        className={`text-sm mt-1 ${isCompleted ? `text-chart-3` : `text-chart-4`}`}
                      >
                        {step.subtitle}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Content Area */}
      <div className="flex-1 p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-lg mb-14">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {/* Render current step */}
            {currentStep === 1 && (
              <BelroseAccountForm
                onComplete={data => handleStepComplete(1, data)}
                initialData={registrationData}
                isCompleted={isStepCompleted(1)}
              />
            )}
            {currentStep === 2 && (
              <EncryptionPasswordSetup
                onComplete={data => handleStepComplete(2, data)}
                isCompleted={isStepCompleted(2)}
                isActivated={isStepCompleted(1)}
              />
            )}
            {currentStep === 3 && (
              <WalletSetup
                userId={registrationData.userId}
                encryptionPassword={registrationData.encryptionPassword}
                initialWalletData={{
                  walletAddress: registrationData.walletAddress,
                  walletType: registrationData.walletType,
                }}
                onComplete={data => handleStepComplete(3, data)}
                isCompleted={isStepCompleted(3)}
                isActivated={isStepCompleted(2)}
              />
            )}

            {currentStep === 4 && (
              <RecoveryKeyDisplay
                recoveryKey={registrationData.recoveryKey}
                onComplete={data => handleStepComplete(4, data)}
                isCompleted={isStepCompleted(4)}
                isActivated={isStepCompleted(2)}
              />
            )}
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
              onClick={handleCompleteRegistration}
              disabled={!canCompleteRegistration()}
              className="rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <span>Complete Registration</span>
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RegistrationForm;
