// src/hooks/useWallet.ts
import { useState, useEffect, useCallback } from 'react';
import { WalletService, WalletConnection, AuthMethod } from '@/features/BlockchainVerification/service/walletService';

export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  address: string;
  chainId: number;
  networkName: string;
  balance: string;
  error: string | null;
  isSupportedNetwork: boolean;
  authMethod: 'web3auth' | 'metamask' | null;
  userInfo: {
    displayName: string;
    identifier: string;
    avatar?: string;
    method: string;
  } | null;
}

export const useWallet = () => {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    isConnecting: false,
    address: '',
    chainId: 0,
    networkName: '',
    balance: '0',
    error: null,
    isSupportedNetwork: false,
    authMethod: null,
    userInfo: null
  });

  // Update wallet state from connection
  const updateWalletState = useCallback(async (connection: WalletConnection | null) => {
    if (!connection) {
      setWalletState(prev => ({
        ...prev,
        isConnected: false,
        address: '',
        chainId: 0,
        networkName: '',
        balance: '0',
        isSupportedNetwork: false,
        authMethod: null,
        userInfo: null,
        error: null
      }));
      return;
    }

    try {
      const balance = await WalletService.getBalance();
      const isSupportedNetwork = WalletService.isSupportedNetwork();
      const userInfo = WalletService.getUserDisplayInfo();

      setWalletState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        address: connection.address,
        chainId: connection.chainId,
        networkName: connection.networkName,
        balance,
        isSupportedNetwork,
        authMethod: connection.authMethod,
        userInfo,
        error: null
      }));
    } catch (error: any) {
      console.error('Failed to update wallet state:', error);
      setWalletState(prev => ({
        ...prev,
        error: error.message
      }));
    }
  }, []);

  // Connect wallet with preferred method
  const connectWallet = useCallback(async (preferredMethod?: AuthMethod) => {
    setWalletState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const connection = await WalletService.connectWallet(preferredMethod);
      await updateWalletState(connection);
    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message
      }));
    }
  }, [updateWalletState]);

  // Connect specifically with Web3Auth
  const connectWithWeb3Auth = useCallback(async (method?: AuthMethod) => {
    setWalletState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const connection = await WalletService.connectWithWeb3Auth(method);
      await updateWalletState(connection);
    } catch (error: any) {
      console.error('Web3Auth connection failed:', error);
      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message
      }));
    }
  }, [updateWalletState]);

  // Connect specifically with MetaMask
  const connectWithMetaMask = useCallback(async () => {
    setWalletState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const connection = await WalletService.connectWithMetaMask();
      await updateWalletState(connection);
    } catch (error: any) {
      console.error('MetaMask connection failed:', error);
      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message
      }));
    }
  }, [updateWalletState]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    try {
      await WalletService.disconnect();
      await updateWalletState(null);
    } catch (error: any) {
      console.error('Disconnect failed:', error);
      setWalletState(prev => ({ ...prev, error: error.message }));
    }
  }, [updateWalletState]);

  // Switch network
  const switchNetwork = useCallback(async (chainId: number) => {
    try {
      setWalletState(prev => ({ ...prev, error: null }));
      await WalletService.switchNetwork(chainId);
      
      // Update state after network switch
      const connection = WalletService.getCurrentConnection();
      await updateWalletState(connection);
    } catch (error: any) {
      setWalletState(prev => ({ ...prev, error: error.message }));
    }
  }, [updateWalletState]);

  // Switch to recommended network (Mumbai)
  const switchToRecommendedNetwork = useCallback(async () => {
    const recommended = WalletService.getRecommendedNetwork();
    await switchNetwork(recommended.chainId);
  }, [switchNetwork]);

  // Sign message
  const signMessage = useCallback(async (message: string): Promise<string> => {
    try {
      setWalletState(prev => ({ ...prev, error: null }));
      return await WalletService.signMessage(message);
    } catch (error: any) {
      setWalletState(prev => ({ ...prev, error: error.message }));
      throw error;
    }
  }, []);

  // Check for existing connection on mount
  useEffect(() => {
    const checkExistingConnection = async () => {
      try {
        const existingConnection = WalletService.getCurrentConnection();
        if (existingConnection) {
          await updateWalletState(existingConnection);
        }
      } catch (error) {
        console.log('No existing wallet connection found');
      }
    };

    checkExistingConnection();
  }, [updateWalletState]);

  // Set up event listeners
  useEffect(() => {
    const handleAccountChanged = async (address: string) => {
      if (address) {
        const connection = WalletService.getCurrentConnection();
        await updateWalletState(connection);
      } else {
        await updateWalletState(null);
      }
    };

    const handleNetworkChanged = async (chainId: number, networkName: string) => {
      const connection = WalletService.getCurrentConnection();
      await updateWalletState(connection);
    };

    WalletService.setupEventListeners(handleAccountChanged, handleNetworkChanged);

    // Cleanup listeners on unmount
    return () => {
      if (WalletService.isMetaMaskAvailable()) {
        window.ethereum?.removeAllListeners?.('accountsChanged');
        window.ethereum?.removeAllListeners?.('chainChanged');
      }
    };
  }, [updateWalletState]);

  return {
    // State
    ...walletState,
    
    // Actions
    connectWallet,
    connectWithWeb3Auth,
    connectWithMetaMask,
    disconnectWallet,
    switchNetwork,
    switchToRecommendedNetwork,
    signMessage,
    
    // Utilities
    isWalletAvailable: WalletService.isWalletAvailable(),
    isMetaMaskAvailable: WalletService.isMetaMaskAvailable(),
    recommendedNetwork: WalletService.getRecommendedNetwork(),
    availableAuthMethods: WalletService.getAvailableAuthMethods()
  };
};