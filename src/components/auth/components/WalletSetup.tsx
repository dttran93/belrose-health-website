// src/features/Auth/components/WalletSetup.tsx

import React, { useState } from 'react';
import { Wallet, Zap, CheckCircle, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { WalletService } from '@/features/BlockchainVerification/service/walletService';
import { UserWalletService } from '@/features/BlockchainVerification/service/userWalletService';
import { auth } from '@/firebase/config';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';

interface WalletSetupProps {
  userId: string;
  onComplete: (data: { walletAddress: string; walletType: 'generated' | 'metamask' }) => void;
  isCompleted: boolean;
  initialWalletData?: { walletAddress?: string; walletType?: 'generated' | 'metamask' };
  isActivated: boolean;
}

type WalletChoice = 'generated' | 'metamask' | null;

export const WalletSetup: React.FC<WalletSetupProps> = ({
  userId,
  initialWalletData,
  onComplete,
  isCompleted = false,
  isActivated = false,
}) => {
  //DEBUG
  console.log(initialWalletData);

  const [walletChoice, setWalletChoice] = useState<WalletChoice>(
    initialWalletData?.walletType || null
  );
  const [metaMaskConnected, setMetaMaskConnected] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string>(
    initialWalletData?.walletAddress || ''
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleConnectMetaMask = async () => {
    setError('');
    setIsProcessing(true);

    try {
      const connection = await WalletService.connectWithMetaMask();
      setMetaMaskConnected(true);
      setConnectedAddress(connection.address);
      setWalletChoice('metamask');
    } catch (err: any) {
      setError(err.message || 'Failed to connect MetaMask');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (!walletChoice) {
      setError('Please choose a wallet option');
      return;
    }

    setIsProcessing(true);

    try {
      if (walletChoice === 'generated') {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('Not authenticated');
        }

        const token = await user.getIdToken();

        // ✅ Get the master key from the session (set during registration)
        const masterKey = EncryptionKeyManager.getSessionKey();
        if (!masterKey) {
          throw new Error('Encryption key not available. Please restart registration.');
        }

        // Convert master key to hex string for transmission
        const masterKeyBytes = await window.crypto.subtle.exportKey('raw', masterKey);
        const masterKeyArray = new Uint8Array(masterKeyBytes);
        const masterKeyHex = Array.from(masterKeyArray)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        console.log('🔑 Sending wallet creation request with master key...');

        const response = await fetch(
          import.meta.env.DEV
            ? 'http://127.0.0.1:5001/belrose-757fe/us-central1/createWallet'
            : 'https://us-central1-belrose-757fe.cloudfunctions.net/createWallet',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              userId,
              masterKeyHex, // ✅ Send the master key for encryption
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create wallet');
        }

        const data = await response.json();
        console.log('✅ Wallet created successfully');
        toast.success('Wallet created successfully!');

        onComplete({
          walletAddress: data.walletAddress,
          walletType: 'generated',
        });
      } else if (walletChoice === 'metamask') {
        await UserWalletService.linkWalletToAccount(userId);
        toast.success('MetaMask wallet linked successfully!');

        onComplete({
          walletAddress: connectedAddress,
          walletType: 'metamask',
        });
      }
    } catch (err: any) {
      console.error('❌ Wallet setup error:', err);
      setError(err.message || 'Failed to setup wallet');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {!isCompleted && (
        <>
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Setup Blockchain Wallet</h2>
            <p className="text-gray-600 mt-2">
              The blockchain is needed to manage the completeness and accuracy of your records for
              third-parties.
            </p>
          </div>
        </>
      )}

      {isCompleted && (
        <>
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Blockchain Wallet Connected</h2>
            <p className="text-gray-600 mt-2">
              The blockchain is needed to manage the completeness and accuracy of your records for
              third-parties.
            </p>
          </div>
        </>
      )}

      {/* Info Box */}
      {isActivated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Protected by your password</p>
              <p className="text-blue-800">
                You can connect your own wallet or auto-generate a wallet with the same password you
                just created.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Activation Info Box*/}
      {!isActivated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-900 flex-1">
              <p className="font-semibold mb-2">
                Create your Belrose Account (Step 1) before connecting your wallet.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Options */}
      {isActivated && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setWalletChoice('generated')}
            disabled={isProcessing}
            className={`p-6 border-2 rounded-lg text-left transition-all ${
              walletChoice === 'generated'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start space-x-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  walletChoice === 'generated' ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              >
                <Zap
                  className={`w-6 h-6 ${
                    walletChoice === 'generated' ? 'text-white' : 'text-gray-600'
                  }`}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="font-semibold text-gray-900">Auto-Generate</h4>
                </div>
                <p className="text-sm text-gray-600">Easy secure setup, works immediately</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => !metaMaskConnected && handleConnectMetaMask()}
            disabled={isProcessing}
            className={`p-6 border-2 rounded-lg text-left transition-all ${
              walletChoice === 'metamask'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-orange-300'
            }`}
          >
            <div className="flex items-start space-x-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  walletChoice === 'metamask' ? 'bg-orange-500' : 'bg-gray-200'
                }`}
              >
                <span className="text-2xl">🦊</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">Connect MetaMask</h4>
                <p className="text-sm text-gray-600">
                  {metaMaskConnected
                    ? `Address: ${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`
                    : 'Use your existing wallet, more secure'}
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/*Connected Wallet Display */}
      {initialWalletData?.walletAddress && initialWalletData?.walletType && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <Check className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="font-semibold text-green-900">
                  {initialWalletData.walletType === 'generated'
                    ? 'Wallet Generated'
                    : 'MetaMask Connected'}
                </h4>
              </div>
              <p className="text-sm text-green-800 font-mono break-all">
                {initialWalletData.walletAddress}
              </p>
              <p className="text-xs text-green-700 mt-2">
                {initialWalletData.walletType === 'generated'
                  ? 'Your wallet has been securely generated and encrypted'
                  : 'Your MetaMask wallet is ready to use'}
              </p>
              <p className="text-xs text-green-700 mt-2">You can connect other wallets in app</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {!isCompleted && isActivated && (
        <div className="flex space-x-3">
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !walletChoice}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                Creating wallet...
              </>
            ) : (
              'Connect Wallet'
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default WalletSetup;
