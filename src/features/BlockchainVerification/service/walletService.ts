// src/services/walletService.ts
export interface WalletConnection {
  address: string;
  provider: any;
  balance?: string;
}

export enum AuthMethod {
  METAMASK = 'metamask',
  WEB3AUTH = 'web3auth'
}

// Supported networks configuration
const SUPPORTED_NETWORKS = {
  1: { // Ethereum Mainnet
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
    blockExplorerUrl: 'https://etherscan.io',
  },
  80001: { // Polygon Mumbai Testnet
    name: 'Polygon Mumbai',
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    blockExplorerUrl: 'https://mumbai.polygonscan.com',
  },
};

export class WalletService {
  private static provider: any = null;

  /**
   * Connect wallet using MetaMask
   */
  static async connectWithMetaMask(): Promise<WalletConnection> {
    try {
      console.log('Starting MetaMask connection...');
      
      // Check if MetaMask is installed
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask not installed. Please install MetaMask to continue.');
      }

      console.log('MetaMask detected, requesting accounts...');

      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      }) as string[];

      console.log('Accounts received:', accounts);

      if (!accounts || accounts.length === 0 || !accounts[0]) {
        throw new Error('No accounts found in MetaMask');
      }

      const address = accounts[0];
      console.log('Connected to MetaMask with address:', address);

      console.log('Getting balance...');

      // Get balance
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      }) as string;

      console.log('Balance received:', balance);

      // Store provider reference
      this.provider = window.ethereum;

      return {
        address,
        provider: window.ethereum,
        balance: balance ? parseInt(balance, 16).toString() : undefined
      };

    } catch (error: any) {
      console.error('MetaMask connection failed:', error);
      
      // Better error handling for different error types
      let errorMessage = 'Unknown error occurred';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code) {
        switch (error.code) {
          case 4001:
            errorMessage = 'User rejected the request';
            break;
          case -32002:
            errorMessage = 'Request already pending. Please check MetaMask.';
            break;
          case -32603:
            errorMessage = 'Internal JSON-RPC error';
            break;
          default:
            errorMessage = `MetaMask error (code: ${error.code})`;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      throw new Error(`MetaMask connection failed: ${errorMessage}`);
    }
  }

  /**
   * Main wallet connection method - only MetaMask for now
   */
  static async connectWallet(preferredMethod?: AuthMethod): Promise<WalletConnection> {
    // For now, always use MetaMask regardless of preferredMethod
    return this.connectWithMetaMask();
  }

  /**
   * Disconnect current wallet
   */
  static async disconnect(): Promise<void> {
    try {
      this.provider = null;
      console.log('Wallet disconnected');
    } catch (error) {
      console.error('Disconnect failed:', error);
      throw error;
    }
  }

  /**
   * Get current provider
   */
  static getProvider(): any {
    return this.provider;
  }

  /**
   * Check if wallet is connected
   */
  static isConnected(): boolean {
    return this.provider !== null;
  }

  /**
   * Get wallet info
   */
  static async getWalletInfo(): Promise<{ address: string; balance?: string } | null> {
    if (!this.provider) {
      return null;
    }

    try {
      const accounts = await this.provider.request({ 
        method: 'eth_accounts' 
      }) as string[];

      if (!accounts || accounts.length === 0 || !accounts[0]) {
        return null;
      }

      const address = accounts[0];
      const balance = await this.provider.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      }) as string;

      return {
        address,
        balance: balance ? parseInt(balance, 16).toString() : undefined
      };
    } catch (error) {
      console.error('Failed to get wallet info:', error);
      return null;
    }
  }

  /**
   * Sign message with current wallet
   */
  static async signMessage(message: string): Promise<string> {
    if (!this.provider) {
      throw new Error('No wallet connected');
    }

    try {
      const accounts = await this.provider.request({ 
        method: 'eth_accounts' 
      }) as string[];

      if (!accounts || accounts.length === 0 || !accounts[0]) {
        throw new Error('No accounts available');
      }

      const address = accounts[0];

      const signature = await this.provider.request({
        method: 'personal_sign',
        params: [message, accounts[0]]
      }) as string;

      return signature;
    } catch (error) {
      console.error('Message signing failed:', error);
      throw error;
    }
  }

  /**
   * Switch to a specific network
   */
  static async switchNetwork(chainId: string): Promise<void> {
    if (!this.provider) {
      throw new Error('No wallet connected');
    }

    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
    } catch (error: any) {
      // If the chain hasn't been added to MetaMask, add it
      if (error.code === 4902) {
        const networkConfig = SUPPORTED_NETWORKS[parseInt(chainId, 16) as keyof typeof SUPPORTED_NETWORKS];
        if (networkConfig) {
          await this.provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId,
              chainName: networkConfig.name,
              rpcUrls: [networkConfig.rpcUrl],
              blockExplorerUrls: [networkConfig.blockExplorerUrl],
            }],
          });
        } else {
          throw new Error(`Network configuration not found for chain ID: ${chainId}`);
        }
      } else {
        throw error;
      }
    }
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}