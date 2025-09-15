// src/hooks/useWallet.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/config';
import { WalletService, WalletConnection, AuthMethod } from '@/features/BlockchainVerification/service/walletService';
import { UserWalletService } from '@/features/BlockchainVerification/service/userWalletService';

export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  address: string;
  balance: string;
  error: string | null;
  authMethod: 'metamask' | null;
  isLinkedToAccount: boolean;
  isLinking: boolean;
  canLinkWallet: boolean;
}

export const useWallet = () => {
  const [user] = useAuthState(auth); // Get current Firebase user
  
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    isConnecting: false,
    address: '',
    balance: '0',
    error: null,
    authMethod: null,
    isLinkedToAccount: false,
    isLinking: false,
    canLinkWallet: false
  });

  // Update wallet state from current wallet info
  const updateWalletState = useCallback(async () => {
    const isConnected = WalletService.isConnected();
    
    if (!isConnected) {
      setWalletState(prev => ({
        ...prev,
        isConnected: false,
        address: '',
        balance: '0',
        authMethod: null,
        isLinkedToAccount: false,
        canLinkWallet: false,
        error: null
      }));
      return;
    }

    try {
      const walletInfo = await WalletService.getWalletInfo();
      if (!walletInfo) {
        throw new Error('Unable to get wallet information');
      }

      // Check if wallet is linked to current user account
      let isLinkedToAccount = false;
      if (user) {
        const linkedWallet = await UserWalletService.getUserWallet(user.uid);
        isLinkedToAccount = linkedWallet?.address?.toLowerCase() === walletInfo.address.toLowerCase();
      }

      setWalletState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        address: walletInfo.address,
        balance: walletInfo.balance || '0',
        authMethod: 'metamask', // We're only using MetaMask now
        isLinkedToAccount,
        canLinkWallet: !!user && !isLinkedToAccount,
        error: null
      }));
    } catch (error: any) {
      console.error('Failed to update wallet state:', error);
      setWalletState(prev => ({
        ...prev,
        error: error.message,
        isConnecting: false
      }));
    }
  }, [user]);

  // Connect wallet with MetaMask
  const connectWallet = useCallback(async (preferredMethod?: AuthMethod) => {
    setWalletState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      await WalletService.connectWallet(preferredMethod);
      await updateWalletState();
    } catch (error: any) {
      console.error('Wallet connection failed:', error);
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
      await WalletService.connectWithMetaMask();
      await updateWalletState();
    } catch (error: any) {
      console.error('MetaMask connection failed:', error);
      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message
      }));
    }
  }, [updateWalletState]);

  // Link wallet to current user account
  const linkWalletToAccount = useCallback(async () => {
    if (!user || !walletState.isConnected) {
      throw new Error('User must be logged in and wallet connected');
    }

    setWalletState(prev => ({ ...prev, isLinking: true, error: null }));

    try {
      await UserWalletService.linkWalletToAccount(user.uid);
      
      // Update state to reflect linking
      setWalletState(prev => ({ 
        ...prev, 
        isLinkedToAccount: true, 
        canLinkWallet: false,
        isLinking: false 
      }));
      
      console.log('Wallet successfully linked to account');
    } catch (error: any) {
      console.error('Failed to link wallet:', error);
      setWalletState(prev => ({ 
        ...prev, 
        error: error.message,
        isLinking: false 
      }));
      throw error;
    }
  }, [user, walletState.isConnected]);

  // Unlink wallet from account
  const unlinkWalletFromAccount = useCallback(async () => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    try {
      await UserWalletService.unlinkWalletFromAccount(user.uid);
      
      // Update state to reflect unlinking
      setWalletState(prev => ({ 
        ...prev, 
        isLinkedToAccount: false,
        canLinkWallet: prev.isConnected 
      }));
      
      console.log('Wallet successfully unlinked from account');
    } catch (error: any) {
      console.error('Failed to unlink wallet:', error);
      setWalletState(prev => ({ ...prev, error: error.message }));
      throw error;
    }
  }, [user]);

  // Connect and link wallet in one step
  const connectAndLinkWallet = useCallback(async (preferredMethod?: AuthMethod) => {
    await connectWallet(preferredMethod);
    
    // Link after successful connection if user is logged in
    if (user) {
      await linkWalletToAccount();
    }
  }, [connectWallet, linkWalletToAccount, user]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    try {
      await WalletService.disconnect();
      await updateWalletState();
    } catch (error: any) {
      console.error('Disconnect failed:', error);
      setWalletState(prev => ({ ...prev, error: error.message }));
    }
  }, [updateWalletState]);

  // Switch network
  const switchNetwork = useCallback(async (chainId: string) => {
    try {
      setWalletState(prev => ({ ...prev, error: null }));
      await WalletService.switchNetwork(chainId);
      
      // Update state after network switch
      await updateWalletState();
    } catch (error: any) {
      setWalletState(prev => ({ ...prev, error: error.message }));
    }
  }, [updateWalletState]);

  // Switch to Polygon Mumbai (recommended for testing)
  const switchToRecommendedNetwork = useCallback(async () => {
    await switchNetwork('0x13881'); // Polygon Mumbai testnet
  }, [switchNetwork]);

  // Sign message and update last used timestamp
  const signMessage = useCallback(async (message: string): Promise<string> => {
    try {
      setWalletState(prev => ({ ...prev, error: null }));
      const signature = await WalletService.signMessage(message);
      
      // Update last used timestamp if wallet is linked
      if (user && walletState.isLinkedToAccount) {
        await UserWalletService.updateWalletLastUsed(user.uid);
      }
      
      return signature;
    } catch (error: any) {
      setWalletState(prev => ({ ...prev, error: error.message }));
      throw error;
    }
  }, [user, walletState.isLinkedToAccount]);

  // Refresh wallet balance
  const refreshBalance = useCallback(async () => {
    if (WalletService.isConnected()) {
      await updateWalletState();
    }
  }, [updateWalletState]);

  // Check for existing connection on mount
  useEffect(() => {
    const checkExistingConnection = () => {
      if (WalletService.isConnected()) {
        updateWalletState();
      }
    };

    checkExistingConnection();
  }, [updateWalletState]);

  // Update linking state when user changes
  useEffect(() => {
    if (walletState.isConnected) {
      updateWalletState();
    }
  }, [user, updateWalletState]);

  // Set up MetaMask event listeners
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected
        await updateWalletState();
      } else {
        // Account changed
        await updateWalletState();
      }
    };

    const handleChainChanged = async (chainId: string) => {
      // Network changed
      await updateWalletState();
    };

    // Add event listeners
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Cleanup listeners on unmount
    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [updateWalletState]);

  return {
    // State
    ...walletState,
    
    // Actions
    connectWallet,
    connectWithMetaMask,
    connectAndLinkWallet,
    disconnectWallet,
    linkWalletToAccount,
    unlinkWalletFromAccount,
    switchNetwork,
    switchToRecommendedNetwork,
    signMessage,
    refreshBalance,
    
    // Utilities
    isMetaMaskAvailable: typeof window !== 'undefined' && !!window.ethereum,
    isUserLoggedIn: !!user,
    currentUserId: user?.uid || null
  };
};