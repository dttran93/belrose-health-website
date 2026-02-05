// /features/Auth/components/RegistrationForm.tsx

import React, { useState } from 'react';
import { Check, ShieldCheck, ArrowRight, ArrowLeft, RotateCcwKey } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import BelroseAccountForm from './BelroseAccountForm';
import { RecoveryKeyDisplay } from './RecoveryKeyDisplay';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { SharingKeyManagementService } from '@/features/Sharing/services/sharingKeyManagementService';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { MemberRegistryBlockchain } from '../services/memberRegistryBlockchain';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';
import { WalletGenerationService } from '../services/walletGenerationService';
import { SmartAccountService } from '@/features/BlockchainWallet/services/smartAccountService';
import RegistrationProgressDialog, {
  RegistrationPhase,
  RegistrationProgress,
} from './ui/RegistrationProgressDialog';

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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [dialogPhase, setDialogPhase] = useState<RegistrationPhase>('idle');
  const [registrationProgress, setRegistrationProgress] = useState<RegistrationProgress | null>(
    null
  );
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isStep1Loading, setIsStep1Loading] = useState(false);

  // Store data from all steps
  const [registrationData, setRegistrationData] = useState({
    userId: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    walletAddress: '',
    walletType: '' as 'generated' | 'metamask' | undefined,
    smartAccountAddress: '',
    recoveryKey: '',
    recoveryKeyHash: '',
    acknowledgedRecoveryKey: false,
    walletGenerationComplete: false,
    encryptedMasterKey: '',
    masterKeyIV: '',
    masterKeySalt: '',
    publicKey: '',
    encryptedPrivateKey: '',
    encryptedPrivateKeyIV: '',
  });

  const steps: StepConfig[] = [
    {
      number: 1,
      title: 'Account Creation',
      subtitle: 'Create your secure Belrose account',
      icon: ShieldCheck,
    },
    {
      number: 2,
      title: 'Recovery Key',
      subtitle: 'Save your recovery key for your encryption and network access',
      icon: RotateCcwKey,
    },
  ];

  const isStepCompleted = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 1:
        //Step 1 is done if we have a userId and email
        return !!(
          registrationData.userId &&
          registrationData.email &&
          registrationData.walletGenerationComplete
        );
      case 2:
        // Step 3 is completed if a recovery Key has been created/saved and acknowledged Recovery Key.
        return !!registrationData.acknowledgedRecoveryKey;
      default:
        return false;
    }
  };

  const canCompleteRegistration = (): boolean => {
    return isStepCompleted(1) && isStepCompleted(2);
  };

  const handleStepComplete = async (stepNumber: number, data: any) => {
    // If completing step 1, generate and encrypt the master key and wallet
    if (stepNumber === 1 && data.password) {
      setIsStep1Loading(true);
      try {
        console.log('🔐 Setting up encryption...');

        // 1. Generate master encryption key
        const masterKey = await EncryptionKeyManager.generateMasterKey();
        console.log('✓ Master key generated');

        // 2. Wrap it with password
        const { encryptedKey, iv, salt } = await EncryptionKeyManager.wrapMasterKeyWithPassword(
          masterKey,
          data.password
        );
        console.log('✓ Master key encrypted');

        // 3. Generate recovery key (24 words) and hash
        const recoveryKey = await EncryptionKeyManager.generateRecoveryKeyFromMasterKey(masterKey);
        console.log('✓ Recovery key generated');
        const recoveryKeyHash = await EncryptionKeyManager.hashRecoveryKey(recoveryKey);

        // 4. generate RSA key pair for sharing
        const { publicKey, privateKey } = await SharingKeyManagementService.generateUserKeyPair();
        console.log('✓ RSA key pair generated');

        // 5. Encrypt RSA private key with master key
        const privateKeyBytes = base64ToArrayBuffer(privateKey);
        const { encrypted: encryptedPrivateKeyBuffer, iv: privateKeyIV } =
          await EncryptionService.encryptFile(privateKeyBytes, masterKey);
        const encryptedPrivateKey = arrayBufferToBase64(encryptedPrivateKeyBuffer);
        const encryptedPrivateKeyIV = arrayBufferToBase64(privateKeyIV);
        console.log('✓ Private key encrypted');

        // 6. Store master key in session for registration process
        EncryptionKeyManager.setSessionKey(masterKey);

        // 7. Generate blockchain wallet
        console.log('💼 Generating blockchain wallet...');
        const walletData = await WalletGenerationService.generateWallet({
          userId: data.userId,
          masterKey,
        });
        console.log('✓ Wallet created:', walletData.walletAddress);

        // 8. Update registration data with all encryption info
        setRegistrationData(prev => ({
          ...prev,
          ...data,
          encryptedMasterKey: encryptedKey,
          masterKeyIV: iv,
          masterKeySalt: salt,
          recoveryKey: recoveryKey,
          recoveryKeyHash: recoveryKeyHash,
          publicKey: publicKey,
          encryptedPrivateKey: encryptedPrivateKey,
          encryptedPrivateKeyIV: encryptedPrivateKeyIV,
          walletAddress: walletData.walletAddress,
          walletType: 'generated',
          walletGenerationComplete: true,
        }));

        toast.success('Account and encryption setup complete!', {
          description: 'Your security is configured',
        });
      } catch (error) {
        console.error('❌ Error setting up encryption:', error);
        toast.error('Failed to set up encryption');
        return; // Don't proceed if encryption setup fails
      } finally {
        setIsStep1Loading(false);
      }
    } else {
      // For other steps, just update data normally
      setRegistrationData(prev => ({
        ...prev,
        ...data,
      }));
    }

    // If last step, trigger complete registration. Else go to next step.
    if (stepNumber === steps.length) {
      setTimeout(() => {
        handleCompleteRegistration();
      }, 0);
    } else {
      setCurrentStep(stepNumber + 1);
    }
  };

  const handleCompleteRegistration = async () => {
    if (!canCompleteRegistration()) {
      toast.error('Please complete all steps before continuing');
      return;
    }

    // Prevent double-clicks
    if (isSubmitting) return;
    setIsSubmitting(true);
    setDialogPhase('registering');
    setDialogError(null);

    try {
      console.log('🔄 Completing registration...');

      // 1. Register EOA wallet on blockchain (creates userId identity)
      setRegistrationProgress({
        step: 'eoa_registration',
        message: 'Registering your account on the secure network',
      });
      const eoaResult = await MemberRegistryBlockchain.registerMemberWallet(
        registrationData.walletAddress
      );

      if (!eoaResult.txHash && eoaResult.message !== 'Already registered') {
        throw new Error('EOA blockchain registration failed - no transaction hash received');
      }

      // 2. Compute and register smart account (adds to existing userId)
      setRegistrationProgress({
        step: 'smart_account_registration',
        message: 'Computing your smart account for network automation...',
      });
      const smartAccountAddress = await SmartAccountService.ensureFullyInitialized();

      // 3. Save core account data to Firestore
      setRegistrationProgress({
        step: 'firestore_update',
        message: 'Finalizing your account...',
      });
      const db = getFirestore();
      const userDocRef = doc(db, 'users', registrationData.userId);

      await updateDoc(userDocRef, {
        email: registrationData.email,
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,

        encryption: {
          enabled: true,
          encryptedMasterKey: registrationData.encryptedMasterKey,
          masterKeyIV: registrationData.masterKeyIV,
          masterKeySalt: registrationData.masterKeySalt,
          encryptedPrivateKey: registrationData.encryptedPrivateKey,
          encryptedPrivateKeyIV: registrationData.encryptedPrivateKeyIV,
          publicKey: registrationData.publicKey,
          recoveryKeyHash: registrationData.recoveryKeyHash,
          setupAt: new Date().toISOString(),
        },

        // Verification fields will be updated later in the verification flow
        emailVerified: false,
        identityVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      setRegistrationProgress({
        step: 'complete',
        message: 'Registration complete!',
      });

      setDialogPhase('success');
    } catch (error) {
      console.error('❌ Registration failed:', error);

      // Provide specific error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      setDialogError(errorMessage);
      setDialogPhase('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogClose = () => {
    if (dialogPhase === 'success') {
      // Navigate on success
      navigate('/verification', {
        replace: true,
        state: {
          userId: registrationData.userId,
          email: registrationData.email,
          fromRegistration: true,
        },
      });
    }
    setDialogPhase('idle');
  };

  const handleRecoveryKeyAcknowledged = (acknowledged: boolean) => {
    setRegistrationData(prev => ({
      ...prev,
      acknowledgedRecoveryKey: acknowledged,
    }));
  };

  return (
    <div className="min-h-screen bg-secondary from-blue-50 to-indigo-100 flex">
      {/* LEFT SIDE - Progress Tracker */}
      <div className="w-1/3 2xl:w-1/4 bg-primary p-12 flex flex-col justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary mb-2">Join Belrose</h1>
          <p className="text-secondary mb-12">
            It takes less than 5 minutes to create your secure health data platform
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
                isExternallyLoading={isStep1Loading}
                onLoadingChange={(isLoading, message) => {
                  if (message) {
                    console.log('Loading:', message);
                  }
                }}
              />
            )}
            {currentStep === 2 && (
              <RecoveryKeyDisplay
                recoveryKey={registrationData.recoveryKey}
                onAcknowledge={handleRecoveryKeyAcknowledged}
                onComplete={handleCompleteRegistration}
                isCompleted={isStepCompleted(2)}
                isActivated={isStepCompleted(1)}
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
              onClick={() => setCurrentStep(Math.min(currentStep + 1, 2))}
              disabled={currentStep === 2}
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

      {/*Registration Progress Dialog for Loading State/Blockchain Update */}
      <RegistrationProgressDialog
        isOpen={dialogPhase !== 'idle'}
        phase={dialogPhase}
        progress={registrationProgress}
        error={dialogError}
        onClose={handleDialogClose}
        onRetry={handleCompleteRegistration}
      />
    </div>
  );
};

export default RegistrationForm;
