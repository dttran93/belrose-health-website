// src/features/Auth/components/WalletSetup.tsx

import React, { useState } from 'react';
import {
  Wallet,
  CheckCircle,
  AlertCircle,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { WalletService } from '@/features/BlockchainWallet/services/walletService';
import { auth } from '@/firebase/config';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

// ==================== TYPES ====================

interface WalletSetupProps {
  userId: string;
  onComplete: (data: { walletAddress: string; walletType: 'generated' | 'metamask' }) => void;
  isCompleted: boolean;
  initialWalletData?: { walletAddress?: string; walletType?: 'generated' | 'metamask' };
  isActivated: boolean;
}

// ==================== WALLET VALIDATION ====================

async function checkWalletAvailability(
  walletAddress: string,
  currentUserId: string
): Promise<{ available: boolean; error?: string }> {
  try {
    const db = getFirestore();
    const normalizedAddress = walletAddress.toLowerCase();

    const walletQuery = query(
      collection(db, 'users'),
      where('wallet.address', '==', normalizedAddress)
    );

    const walletQueryChecksum = query(
      collection(db, 'users'),
      where('wallet.address', '==', walletAddress)
    );

    const [results, resultsChecksum] = await Promise.all([
      getDocs(walletQuery),
      getDocs(walletQueryChecksum),
    ]);

    const allDocs = [...results.docs, ...resultsChecksum.docs];
    const otherUserHasWallet = allDocs.some(doc => doc.id !== currentUserId);

    if (otherUserHasWallet) {
      return {
        available: false,
        error: 'This wallet address is already registered to another account.',
      };
    }

    return { available: true };
  } catch (error) {
    console.error('Error checking wallet availability:', error);
    return { available: true };
  }
}

// ==================== COMPONENT ====================

export const WalletSetup: React.FC<WalletSetupProps> = ({
  userId,
  initialWalletData,
  onComplete,
  isCompleted = false,
  isActivated = false,
}) => {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [metaMaskConnected, setMetaMaskConnected] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidatingWallet, setIsValidatingWallet] = useState(false);
  const [useMetaMask, setUseMetaMask] = useState(false);
  const [error, setError] = useState('');

  // ==================== HANDLERS ====================

  const handleConnectMetaMask = async () => {
    setError('');
    setIsProcessing(true);
    setIsValidatingWallet(true);

    try {
      const connection = await WalletService.connectMetaMask();

      console.log('🔍 Checking wallet availability...');
      const availability = await checkWalletAvailability(connection.address, userId);

      if (!availability.available) {
        setError(availability.error || 'Wallet already in use');
        toast.error('Wallet already registered', {
          description: 'This wallet is connected to another account.',
        });
        return;
      }

      console.log('✅ Wallet is available');
      setMetaMaskConnected(true);
      setConnectedAddress(connection.address);
      setUseMetaMask(true);

      toast.success('MetaMask connected!', {
        description: `${connection.address.slice(0, 6)}...${connection.address.slice(-4)}`,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to connect MetaMask');
    } finally {
      setIsProcessing(false);
      setIsValidatingWallet(false);
    }
  };

  const handleCreateGeneratedWallet = async () => {
    setError('');
    setIsProcessing(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated');
      }

      const token = await user.getIdToken();

      const masterKey = EncryptionKeyManager.getSessionKey();
      if (!masterKey) {
        throw new Error('Encryption key not available. Please restart registration.');
      }

      const masterKeyBytes = await window.crypto.subtle.exportKey('raw', masterKey);
      const masterKeyArray = new Uint8Array(masterKeyBytes);
      const masterKeyHex = Array.from(masterKeyArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      console.log('🔑 Creating wallet...');

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
            masterKeyHex,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create wallet');
      }

      const data = await response.json();
      console.log('✅ Wallet created:', data.walletAddress);

      /* Top up gas so user can transact
      console.log('⛽ Requesting initial gas...');
      try {
        await GasService.requestTopUp(data.walletAddress);
        console.log('✅ Gas topped up');
      } catch (gasError) {
        // Don't fail registration if gas top-up fails
        console.warn('⚠️ Gas top-up failed, user can request later:', gasError);
      }
      */

      toast.success('Wallet created successfully!');

      onComplete({
        walletAddress: data.walletAddress,
        walletType: 'generated',
      });
    } catch (err: any) {
      console.error('❌ Wallet creation error:', err);
      setError(err.message || 'Failed to create wallet');
      toast.error('Wallet creation failed', { description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConnectMetaMaskWallet = async () => {
    if (!connectedAddress) {
      setError('Please connect MetaMask first');
      return;
    }

    setError('');
    setIsProcessing(true);

    try {
      await WalletService.saveExternalWallet(userId, connectedAddress);
      toast.success('MetaMask wallet linked!');

      onComplete({
        walletAddress: connectedAddress,
        walletType: 'metamask',
      });
    } catch (err: any) {
      console.error('❌ MetaMask link error:', err);
      setError(err.message || 'Failed to link wallet');
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================== RENDER ====================

  // Completed State
  if (initialWalletData?.walletAddress && initialWalletData?.walletType) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Wallet Ready</h2>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <Check className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-green-900">
                {initialWalletData.walletType === 'generated'
                  ? 'Secure Wallet Created'
                  : 'MetaMask Connected'}
              </h4>
              <p className="text-sm text-green-800 font-mono break-all mt-1">
                {initialWalletData.walletAddress}
              </p>
              <p className="text-xs text-green-700 mt-2">
                {initialWalletData.walletType === 'generated'
                  ? 'Protected by your Recovery Key'
                  : 'Managed by MetaMask'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not Activated State
  if (!isActivated) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-primary">Blockchain Connection</h2>
          <p className="text-gray-600 mt-2">
            A blockchain connection ensures record reliability and Belrose platform's auditability.
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-900">Complete Step 1 to set up your wallet.</p>
          </div>
        </div>
      </div>
    );
  }

  // Active Setup State
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Blockchain Connection</h2>
        <p className="text-gray-600 mt-2">
          A blockchain connection ensures record reliability and Belrose platform's auditability.
        </p>
      </div>

      {/* Recommended Option - Generated Wallet */}
      <div className="border-2 border-chart-2 bg-chart-2/10 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-3">
          <span className="bg-chart-2 text-white text-xs font-semibold px-2 py-1 rounded">
            RECOMMENDED
          </span>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Generate Secure Wallet for Blockchain Connection
        </h3>

        <p className="text-gray-600 text-sm mb-4">We recommend this because:</p>

        {/* Benefits */}
        <div className="space-y-2 mb-5 text-left">
          <div className="flex items-center space-x-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 mr-2 text-chart-2 flex-shrink-0" />
            <span>No crypto to buy or manage - we handle transaction fees</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 mr-2 text-chart-2 flex-shrink-0" />
            <span>Protected by your Recovery Key - one key for everything (Step 3)</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 mr-2 text-chart-2 flex-shrink-0" />
            <span>Works instantly - no browser extensions or apps to install</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 mr-2 text-chart-2 flex-shrink-0" />
            <span>
              Non-custodial - you have complete control and can move it to other services as desired
            </span>
          </div>
        </div>

        <Button
          onClick={handleCreateGeneratedWallet}
          disabled={isProcessing || useMetaMask}
          className="w-full"
        >
          {isProcessing && !useMetaMask ? (
            <>
              <Loader2 className="animate-spin h-5 w-5 mr-2" />
              Creating Wallet...
            </>
          ) : (
            <>
              <Shield className="w-5 h-5 mr-2" />
              Create Secure Wallet
            </>
          )}
        </Button>
      </div>

      {/* Advanced Options Toggle */}
      <div className="border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          className="flex items-center justify-center w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          {showAdvancedOptions ? (
            <>
              <ChevronUp className="w-4 h-4 mr-1" />
              Hide advanced options
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-1" />I already have a crypto wallet
            </>
          )}
        </button>

        {/* MetaMask Option */}
        {showAdvancedOptions && (
          <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center space-x-3 mb-3">
              <div>
                <h4 className="font-medium text-gray-900">Connect Your Own Wallet</h4>
              </div>
            </div>

            {metaMaskConnected ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 bg-green-100 text-green-800 rounded-lg px-3 py-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-mono">
                    {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
                  </span>
                </div>
                <Button
                  onClick={handleConnectMetaMaskWallet}
                  disabled={isProcessing}
                  variant="outline"
                  className="w-full"
                >
                  {isProcessing && useMetaMask ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Linking...
                    </>
                  ) : (
                    'Use This Wallet'
                  )}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleConnectMetaMask}
                disabled={isProcessing}
                variant="outline"
                className="w-full"
              >
                {isValidatingWallet ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Connecting...
                  </>
                ) : (
                  '🦊 Connect MetaMask'
                )}
              </Button>
            )}

            <p className="text-xs text-gray-500 mt-3">
              You'll need ETH for transaction fees if you use your own wallet.
            </p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
};

export default WalletSetup;
