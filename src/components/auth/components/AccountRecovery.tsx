// src/components/auth/components/AccountRecovery.tsx

import { useState } from 'react';
import { ArrowLeft, Mail, KeyRound, HelpCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import * as Tooltip from '@radix-ui/react-tooltip';
import ResetPasswordForm from './ResetPasswordForm';
import RecoveryKeyForm from './RecoveryKeyForm';

interface AccountRecoveryProps {
  onBackToLogin: () => void;
}

type AccountRecoveryState = 'accountRecoveryHub' | 'recoveryKey' | 'resetPassword';

export const AccountRecovery: React.FC<AccountRecoveryProps> = ({ onBackToLogin }) => {
  const [currentView, setCurrentView] = useState<AccountRecoveryState>('accountRecoveryHub');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-card">
      <div className="w-full max-w-2xl">
        {currentView === 'accountRecoveryHub' && (
          <>
            {/* Back to Login Button */}
            <button
              onClick={onBackToLogin}
              className="flex items-center space-x-2 text-foreground hover:text-primary mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Login</span>
            </button>
          </>
        )}

        {currentView !== 'accountRecoveryHub' && (
          <>
            {/* Back to Recovery Hub Button */}
            <button
              onClick={() => {
                setCurrentView('accountRecoveryHub');
              }}
              className="flex items-center space-x-2 text-foreground hover:text-primary mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Recovery Hub</span>
            </button>
          </>
        )}

        {/* Main Card */}
        <div className="bg-background rounded-2xl shadow-xl p-8 border border-gray-100">
          {currentView === 'accountRecoveryHub' && (
            <>
              {/* Header */}
              <div className="text-center">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <HelpCircle className="w-8 h-8 text-secondary" />
                </div>
                <h1 className="text-3xl font-bold text-primary">Account Recovery</h1>
              </div>
              {/* Critical Warning */}
              <div className="rounded-lg bg-red-50 border-2 border-red-300 p-6 m-4">
                <div className="flex space-x-3">
                  <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="text-l text-primary">
                      If you reset your password without your recovery key, your encrypted health
                      data will be <b>permanently lost</b>.
                      <Tooltip.Provider>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <button className="inline-flex items-center ml-1 text-foreground hover:text-red-800">
                              <HelpCircle className="w-3 h-3" />
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content
                              className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
                              sideOffset={5}
                            >
                              <p className="font-semibold mb-2 text-sm">Why this happens:</p>
                              <ol className="list-decimal list-inside space-y-1 text-xs">
                                <li>
                                  Your Password protects your Encryption Key. Belrose does not know
                                  either Password nor your Encryption Key
                                </li>
                                <li>A new password can't decrypt the old Encryption Key</li>
                                <li>
                                  Without the Encryption Key, your health data is unrecoverable
                                </li>
                                <li>Only your 24-word recovery key can restore access</li>
                              </ol>
                              <Tooltip.Arrow className="fill-gray-900" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </Tooltip.Provider>
                    </h2>
                  </div>
                </div>
              </div>

              {/* Decision Options */}
              <div className="space-y-4 mb-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Choose Your Situation:</h2>

                {/* Option 1: Have Recovery Key - RECOMMENDED */}
                <div className="text-foreground border-2 border-primary bg-background hover:border-green-400 hover:bg-green-50 hover:text-green-600 rounded-lg p-6 transition-colors shadow-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-3xl">✅</span>
                        <h3 className="font-bold text-lg">I Have My 24-Word Recovery Key</h3>
                      </div>
                      <div className="bg-transparent rounded p-3 mb-3">
                        <p className="text-sm font-semibold mb-1">✨ BEST - Full Recovery</p>
                        <p className="text-xs">
                          This will restore complete access to your encrypted data AND let you set a
                          new password. This is the safest option.
                        </p>
                      </div>

                      <Button
                        onClick={() => {
                          setCurrentView('recoveryKey');
                        }}
                        variant="default"
                        size="lg"
                        className="w-full"
                      >
                        <KeyRound className="w-5 h-5 mr-2" />
                        Use My Recovery Key (Recommended)
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Option 2: No Recovery Key - DATA LOSS */}
                <div className="bg-background border-2 border-primary hover:border-red-400 hover:bg-red-50 rounded-lg p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-1 hover:text-red-600">
                      <h3 className="text-left font-bold mb-2 text-lg">
                        ❌ I Don't Have My Recovery Key
                      </h3>

                      <div className="bg-transparent rounded p-4 mb-2">
                        <p className="text-sm font-bold mb-2">
                          ⚠️ WARNING: Your encrypted data will be permanently lost
                        </p>
                        <p className="text-xs">
                          There is NO way to recover your encrypted data without your recovery key.
                          This is by design for security - even Belrose staff cannot decrypt your
                          data.
                        </p>
                        <p className="text-xs m-2">
                          You CAN reset your password via email, and set up a new encryption and
                          recovery key to add new records. But the old data is gone.
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          setCurrentView('resetPassword');
                        }}
                        variant="destructive"
                        size="lg"
                        className="w-full"
                      >
                        <Mail className="w-5 h-5 mr-2" />
                        Reset Password (I Understand Data Will Be Lost)
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {currentView === 'recoveryKey' && (
            <>
              <RecoveryKeyForm onBackToLogin={onBackToLogin} />
            </>
          )}
          {currentView === 'resetPassword' && (
            <ResetPasswordForm
              onBackToLogin={onBackToLogin}
              onSwitchToRecovery={() => {
                setCurrentView('recoveryKey');
              }}
            />
          )}
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Remember your password?{' '}
            <button
              onClick={onBackToLogin}
              className="text-destructive hover:underline font-medium"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccountRecovery;
