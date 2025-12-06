// src/features/Auth/components/WalletSetup.tsx

import React, { useState } from 'react';
import { Wallet, Zap, CheckCircle, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { WalletService } from '@/features/BlockchainWallet/services/walletService';
import { auth } from '@/firebase/config';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

// ==================== TYPES ====================

interface WalletSetupProps {
  userId: string;
  onComplete: (data: { walletAddress: string; walletType: 'generated' | 'metamask' }) => void;
  isCompleted: boolean;
  initialWalletData?: { walletAddress?: string; walletType?: 'generated' | 'metamask' };
  isActivated: boolean;
}

type WalletChoice = 'generated' | 'metamask' | null;

// Unified wallet structure to be saved in Firestore
interface WalletData {
  address: string;
  origin: 'generated' | 'metamask' | 'walletconnect' | 'hardware';
  createdAt: string;
  lastUsed: string;
  // Only present for generated wallets
  encryptedPrivateKey?: string;
  keyIv?: string;
  keyAuthTag?: string;
  keySalt?: string;
  encryptedMnemonic?: string;
  mnemonicIv?: string;
  mnemonicAuthTag?: string;
  mnemonicSalt?: string;
}

// ==================== WALLET VALIDATION ====================

/**
 * Check if a wallet address is already registered to another user
 */
async function checkWalletAvailability(
  walletAddress: string,
  currentUserId: string
): Promise<{ available: boolean; error?: string }> {
  try {
    const db = getFirestore();
    const normalizedAddress = walletAddress.toLowerCase();

    // Query the unified wallet.address field
    const walletQuery = query(
      collection(db, 'users'),
      where('wallet.address', '==', normalizedAddress)
    );

    // Also check with checksum address (some may be stored with original case)
    const walletQueryChecksum = query(
      collection(db, 'users'),
      where('wallet.address', '==', walletAddress)
    );

    const [results, resultsChecksum] = await Promise.all([
      getDocs(walletQuery),
      getDocs(walletQueryChecksum),
    ]);

    // Combine results and check if any belong to a different user
    const allDocs = [...results.docs, ...resultsChecksum.docs];
    const otherUserHasWallet = allDocs.some(doc => doc.id !== currentUserId);

    if (otherUserHasWallet) {
      return {
        available: false,
        error:
          'This wallet address is already registered to another account. Please use a different wallet.',
      };
    }

    return { available: true };
  } catch (error) {
    console.error('Error checking wallet availability:', error);
    // Allow to proceed - blockchain will be the final check
    return { available: true };
  }
}

export const WalletSetup: React.FC<WalletSetupProps> = ({
  userId,
  initialWalletData,
  onComplete,
  isCompleted = false,
  isActivated = false,
}) => {
  const [walletChoice, setWalletChoice] = useState<WalletChoice>(
    initialWalletData?.walletType || null
  );
  const [metaMaskConnected, setMetaMaskConnected] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string>(
    initialWalletData?.walletAddress || ''
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidatingWallet, setIsValidatingWallet] = useState(false);
  const [error, setError] = useState('');

  const handleConnectMetaMask = async () => {
    setError('');
    setIsProcessing(true);
    setIsValidatingWallet(true);

    try {
      //Step 1: Connect to MetaMask
      const connection = await WalletService.connectMetaMask();

      // Step 2: Check if wallet is already registered
      console.log('🔍 Checking wallet availability...');
      const availability = await checkWalletAvailability(connection.address, userId);

      if (!availability.available) {
        setError(availability.error || 'Wallet already in use');
        toast.error('Wallet already registered', {
          description:
            'This wallet is connected to another account. Please use a different wallet.',
        });
        return;
      }

      //Wallet is available
      console.log('✅ Wallet is available');

      setMetaMaskConnected(true);
      setConnectedAddress(connection.address);
      setWalletChoice('metamask');
    } catch (err: any) {
      setError(err.message || 'Failed to connect MetaMask');
    } finally {
      setIsProcessing(false);
      setIsValidatingWallet(false);
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
      // Generated Wallet Flow
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
        await WalletService.saveExternalWallet(userId, connectedAddress);
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

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Blockchain Wallet</h2>
        <p className="text-gray-600 mt-2">
          Your wallet enables secure, verifiable health record management
        </p>
      </div>

      {/* Wallet Options - Only show if not completed */}
      {!isCompleted && isActivated && (
        <div className="space-y-4">
          {/* Auto-Generate Option */}
          <button
            type="button"
            onClick={() => setWalletChoice('generated')}
            disabled={isProcessing}
            className={`w-full p-6 border-2 rounded-lg text-left transition-all ${
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

          {/* MetaMask Option */}
          <button
            type="button"
            onClick={() => !metaMaskConnected && handleConnectMetaMask()}
            disabled={isProcessing}
            className={`w-full p-6 border-2 rounded-lg text-left transition-all ${
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
                {isValidatingWallet ? (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking wallet availability...</span>
                  </div>
                ) : metaMaskConnected ? (
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-700">
                      {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Use your existing wallet, more control</p>
                )}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Connected Wallet Display (when completed) */}
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
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-800 font-medium">Wallet Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      {!isCompleted && isActivated && (
        <div className="flex space-x-3">
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !walletChoice}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                {walletChoice === 'generated' ? 'Creating wallet...' : 'Connecting...'}
              </>
            ) : (
              'Connect Wallet'
            )}
          </Button>
        </div>
      )}

      {/* Info Box */}
      {!isCompleted && isActivated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            <strong>Why a wallet?</strong> Your blockchain wallet creates an immutable record of
            your health data permissions. Each wallet can only be linked to one Belrose account to
            ensure secure, verifiable identity.
          </p>
        </div>
      )}
    </div>
  );
};

export default WalletSetup;
