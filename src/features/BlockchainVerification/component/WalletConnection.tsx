// src/components/WalletConnection.tsx
import React, { useState } from 'react';
import { useWallet } from '@/features/BlockchainVerification/hooks/useWallet';
import { AuthMethod } from '@/features/BlockchainVerification/service/walletService';

interface WalletConnectionProps {
  onConnectionChange?: (connected: boolean, address?: string) => void;
  showBalance?: boolean;
  className?: string;
  mode?: 'simple' | 'advanced'; // Simple shows Web3Auth first, Advanced shows all options
}

export const WalletConnection: React.FC<WalletConnectionProps> = ({
  onConnectionChange,
  showBalance = true,
  className = '',
  mode = 'simple'
}) => {
  const {
    isConnected,
    isConnecting,
    address,
    networkName,
    balance,
    error,
    isSupportedNetwork,
    authMethod,
    userInfo,
    availableAuthMethods,
    recommendedNetwork,
    connectWithWeb3Auth,
    connectWithMetaMask,
    disconnectWallet,
    switchToRecommendedNetwork
  } = useWallet();

  const [showAdvancedOptions, setShowAdvancedOptions] = useState(mode === 'advanced');
  const [connectingWith, setConnectingWith] = useState<AuthMethod | null>(null);

  // Notify parent of connection changes
  React.useEffect(() => {
    onConnectionChange?.(isConnected, address);
  }, [isConnected, address, onConnectionChange]);

  const handleConnect = async (method: AuthMethod) => {
    setConnectingWith(method);
    try {
      if (method === 'metamask') {
        await connectWithMetaMask();
      } else {
        await connectWithWeb3Auth(method);
      }
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
            Choose how you'd like to sign in to enable blockchain verification for your medical records.
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

        {!showAdvancedOptions ? (
          // Simple mode - Web3Auth options first
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {/* Google - Primary recommendation */}
              <button
                onClick={() => handleConnect('google')}
                disabled={isConnecting || connectingWith === 'google'}
                className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
              >
                {connectingWith === 'google' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting with Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continue with Google</span>
                    <span className="ml-auto text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">Recommended</span>
                  </>
                )}
              </button>

              {/* Email option */}
              <button
                onClick={() => handleConnect('email_passwordless')}
                disabled={isConnecting || connectingWith === 'email_passwordless'}
                className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-gray-700"
              >
                {connectingWith === 'email_passwordless' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting with Email...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Continue with Email</span>
                  </>
                )}
              </button>
            </div>

            {/* Advanced options toggle */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowAdvancedOptions(true)}
                className="text-sm text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1 mx-auto"
              >
                <span>More options</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          // Advanced mode - show all available options
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableAuthMethods.map((method) => (
                <button
                  key={method.method}
                  onClick={() => handleConnect(method.method)}
                  disabled={!method.available || isConnecting || connectingWith === method.method}
                  className={`flex items-center justify-center gap-3 px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                    !method.available
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      : method.method === 'google'
                      ? 'bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-300 hover:bg-blue-100'
                      : method.method === 'metamask'
                      ? 'bg-orange-50 border-orange-200 text-orange-700 hover:border-orange-300 hover:bg-orange-100'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  title={method.available ? method.description : `${method.name} is not available`}
                >
                  {connectingWith === method.method ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">Connecting...</span>
                    </>
                  ) : (
                    <>
                      {method.method === 'metamask' && <span className="text-lg">🦊</span>}
                      {method.method === 'google' && <span className="text-lg">🔍</span>}
                      {method.method === 'facebook' && <span className="text-lg">📘</span>}
                      {method.method === 'email_passwordless' && <span className="text-lg">📧</span>}
                      {method.method === 'twitter' && <span className="text-lg">🐦</span>}
                      <span className="text-sm">{method.name}</span>
                    </>
                  )}
                </button>
              ))}
            </div>

            {/* Back to simple mode */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowAdvancedOptions(false)}
                className="text-sm text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1 mx-auto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                <span>Show less</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Connected state
  return (
    <div className={`p-6 bg-white border rounded-lg shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Connected</h3>
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

      {/* User Info Display */}
      <div className="space-y-4">
        {userInfo && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            {userInfo.avatar && (
              <img 
                src={userInfo.avatar} 
                alt="Profile" 
                className="w-10 h-10 rounded-full"
              />
            )}
            <div className="flex-1">
              <p className="font-medium text-gray-900">{userInfo.displayName}</p>
              <p className="text-sm text-gray-600">{userInfo.identifier}</p>
              <p className="text-xs text-gray-500">via {userInfo.method}</p>
            </div>
            <button
              onClick={disconnectWallet}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Wallet Details */}
        <div className="p-3 bg-gray-50 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Wallet Address</span>
            <span className="text-sm text-gray-600 font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Network</span>
            <span className="text-sm text-gray-600">{networkName}</span>
          </div>

          {showBalance && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Balance</span>
              <span className="text-sm text-gray-600">{parseFloat(balance).toFixed(4)} MATIC</span>
            </div>
          )}
        </div>

        {/* Network Status */}
        {!isSupportedNetwork && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-700 text-sm font-medium">Unsupported Network</p>
                <p className="text-orange-600 text-xs">Switch to {recommendedNetwork.name} for blockchain verification</p>
              </div>
              <button
                onClick={switchToRecommendedNetwork}
                className="text-sm bg-orange-100 text-orange-700 px-3 py-1 rounded hover:bg-orange-200 transition-colors font-medium"
              >
                Switch Network
              </button>
            </div>
          </div>
        )}

        {/* Ready State */}
        {isSupportedNetwork && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm font-medium flex items-center gap-2">
              <span className="text-green-500">✅</span>
              Ready for blockchain verification!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};