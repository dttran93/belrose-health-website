// src/components/WalletConnection.tsx
import React, { useState } from 'react';
import { useWallet } from '@/features/BlockchainVerification/hooks/useWallet';
import { AuthMethod } from '@/features/BlockchainVerification/service/walletService';

interface WalletConnectionProps {
  onConnectionChange?: (connected: boolean, address?: string) => void;
  showBalance?: boolean;
  className?: string;
}

export const WalletConnection: React.FC<WalletConnectionProps> = ({
  onConnectionChange,
  showBalance = true,
  className = ''
}) => {
  const {
    isConnected,
    isConnecting,
    address,
    balance,
    error,
    authMethod,
    isMetaMaskAvailable,
    connectWithMetaMask,
    disconnectWallet,
    switchToRecommendedNetwork
  } = useWallet();

  const [connectingWith, setConnectingWith] = useState<'metamask' | null>(null);

  // Notify parent of connection changes
  React.useEffect(() => {
    onConnectionChange?.(isConnected, address);
  }, [isConnected, address, onConnectionChange]);

  const handleConnect = async () => {
    setConnectingWith('metamask');
    try {
      await connectWithMetaMask();
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setConnectingWith(null);
    }
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className={`p-6 bg-white border rounded-lg shadow-sm ${className}`}>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Wallet</h3>
          <p className="text-gray-600 text-sm">
            Connect with MetaMask to enable blockchain verification for your medical records.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-red-500 text-lg">⚠️</span>
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {!isMetaMaskAvailable ? (
            // MetaMask not installed
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🦊</span>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">MetaMask Required</h4>
              <p className="text-gray-600 text-sm mb-4">
                You need MetaMask installed to connect your wallet.
              </p>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                <span>Install MetaMask</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          ) : (
            // MetaMask available
            <button
              onClick={handleConnect}
              disabled={isConnecting || connectingWith === 'metamask'}
              className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
            >
              {connectingWith === 'metamask' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Connecting to MetaMask...</span>
                </>
              ) : (
                <>
                  <span className="text-xl">🦊</span>
                  <span>Connect with MetaMask</span>
                </>
              )}
            </button>
          )}

          {/* Info about future features */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              More wallet options coming soon (Google, Email, etc.)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Connected state
  return (
    <div className={`p-6 bg-white border rounded-lg shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Wallet Connected</h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-green-700 font-medium">Active</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm font-medium">⚠️ {error}</p>
        </div>
      )}

      {/* Wallet Details */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <span className="text-lg">🦊</span>
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">MetaMask Wallet</p>
            <p className="text-sm text-gray-600 font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
          </div>
          <button
            onClick={disconnectWallet}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Disconnect
          </button>
        </div>

        {showBalance && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Balance</span>
              <span className="text-sm text-gray-600">
                {balance ? `${(parseInt(balance) / 1e18).toFixed(4)} ETH` : 'Loading...'}
              </span>
            </div>
          </div>
        )}

        {/* Network recommendation */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-700 text-sm font-medium">Network Recommendation</p>
              <p className="text-blue-600 text-xs">
                For best experience, switch to Polygon Mumbai testnet
              </p>
            </div>
            <button
              onClick={switchToRecommendedNetwork}
              className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition-colors font-medium"
            >
              Switch Network
            </button>
          </div>
        </div>

        {/* Ready State */}
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 text-sm font-medium flex items-center gap-2">
            <span className="text-green-500">✅</span>
            Ready for blockchain verification!
          </p>
        </div>
      </div>
    </div>
  );
};