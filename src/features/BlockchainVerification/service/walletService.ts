// src/services/walletService.ts
import { ethers } from 'ethers';
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK } from '@web3auth/base';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';


export interface WalletConnection {
  address: string;
  provider: ethers.BrowserProvider;
  signer: ethers.JsonRpcSigner;
  chainId: number;
  networkName: string;
  authMethod: 'web3auth' | 'metamask';
  userInfo?: {
    email?: string;
    name?: string;
    profileImage?: string;
    typeOfLogin?: string;
  }
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl?: string;
  blockExplorerUrl?: string;
}

// Supported networks for your MVP
export const SUPPORTED_NETWORKS: Record<number, NetworkConfig> = {
  1: { 
    chainId: 1, 
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
    blockExplorerUrl: 'https://etherscan.io'
  },
  11155111: { 
    chainId: 11155111, 
    name: 'Sepolia Testnet',
    rpcUrl: 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
    blockExplorerUrl: 'https://sepolia.etherscan.io'
  },
  137: { 
    chainId: 137, 
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorerUrl: 'https://polygonscan.com'
  },
  80001: { 
    chainId: 80001, 
    name: 'Polygon Mumbai',
    rpcUrl: 'https://rpc-mumbai.maticvigil.com/',
    blockExplorerUrl: 'https://mumbai.polygonscan.com'
  }
};

export type AuthMethod = 'google' | 'facebook' | 'email_passwordless' | 'metamask' | 'twitter';

export class WalletService {
  private static provider: ethers.BrowserProvider | null = null;
  private static currentConnection: WalletConnection | null = null;
  private static web3auth: Web3Auth | null = null;
  private static web3authProvider: IProvider | null = null;

  // Initialize Web3Auth Instance
  private static async initWeb3Auth(): Promise<Web3Auth> {
    if (this.web3auth) {
      return this.web3auth;
    }

    try {
      // Configure for Polygon Mumbai (testnet)
      const chainConfig = {
        chainNamespace: CHAIN_NAMESPACES.EIP155,
        chainId: "0x13881", // 80001 in hex (Polygon Mumbai)
        rpcTarget: SUPPORTED_NETWORKS[80001]!.rpcUrl!,
        displayName: SUPPORTED_NETWORKS[80001]!.name,
        blockExplorerUrl: SUPPORTED_NETWORKS[80001]!.blockExplorerUrl!,
        ticker: "MATIC",
        tickerName: "MATIC",
        logo: "https://cryptologos.cc/logos/polygon-matic-logo.png",
      };

      const privateKeyProvider = new EthereumPrivateKeyProvider({
        config: { chainConfig },
      });

      this.web3auth = new Web3Auth({
        clientId: process.env.REACT_APP_WEB3AUTH_CLIENT_ID!,
        web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
        chainConfig,
        privateKeyProvider,
        uiConfig: {
          appName: "Medical Records Verification",
          theme: {
            primary: "#3B82F6",
          },
          mode: "light",
          defaultLanguage: "en",
          loginMethodsOrder: ["google", "facebook", "email_passwordless", "twitter"],
        },
      });

      await this.web3auth.initModal();
      console.log('Web3Auth initialized successfully');
      
      return this.web3auth;
    } catch (error) {
      console.error('Web3Auth initialization failed:', error);
      throw new Error(`Failed to initialize Web3Auth: ${error}`);
    }
  }

  //Check if a Web3 wallet Meta Mask is available
  static isMetaMaskAvailable(): boolean {
    return typeof window !== 'undefined' && !! window.ethereum;
  }

  // Connect using Web3Auth
  static async connectWithWeb3Auth(method?: AuthMethod): Promise<WalletConnection> {
  try {
    const web3auth = await this.initWeb3Auth();
    
    // Connect with specific method or let user choose
    const web3authProvider = method ? await web3auth.connectTo(method) : await web3auth.connect();
    
    if (!web3authProvider) {
      throw new Error('Web3Auth connection failed - no provider returned');
    }

    this.web3authProvider = web3authProvider;

    // Create ethers provider from Web3Auth
    const provider = new ethers.BrowserProvider(web3authProvider);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);


    // Get user information from Web3Auth
    const userInfo = await web3auth.getUserInfo();

    //Safely extract properties to avoid TypeScript errors
    const email = userInfo?.email;
    const name = userInfo?.name;
    const profileImage = userInfo?.profileImage;
    const typeOfLogin = (userInfo as any)?.typeOfLogin || 'unknown';

    const connection: WalletConnection = {
      address,
      provider,
      signer,
      chainId,
      networkName: SUPPORTED_NETWORKS[chainId]?.name || `Unknown Network (${chainId})`,
      authMethod: 'web3auth',
      userInfo: {
        email: email,
        name: name,
        profileImage: profileImage,
        typeOfLogin: typeOfLogin
      }
    };

    this.provider = provider;
    this.currentConnection = connection;

    console.log('✅ Web3Auth wallet connected:', {
      address: connection.address,
      network: connection.networkName,
      user: email || name,
      loginType: typeOfLogin
    });

    return connection;
  } catch (error: any) {
    console.error('❌ Web3Auth connection failed:', error);
    
    if (error.message.includes('User closed the modal')) {
      throw new Error('Connection cancelled by user.');
    } else {
      throw new Error(`Failed to connect with Web3Auth: ${error.message}`);
    }
  }
}

  // Connect using MetaMask (traditional Web3 wallet)
  static async connectWithMetaMask(): Promise<WalletConnection> {
    if (!this.isMetaMaskAvailable()) {
      throw new Error('MetaMask not detected. Please install MetaMask or use social login.');
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please unlock your MetaMask.');
      }

      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      const connection: WalletConnection = {
        address: accounts[0],
        provider,
        signer,
        chainId,
        networkName: SUPPORTED_NETWORKS[chainId]?.name || `Unknown Network (${chainId})`,
        authMethod: 'metamask'
      };

      this.provider = provider;
      this.currentConnection = connection;

      console.log('✅ MetaMask wallet connected:', {
        address: connection.address,
        network: connection.networkName,
        method: 'MetaMask'
      });

      return connection;
    } catch (error: any) {
      console.error('❌ MetaMask connection failed:', error);
      
      if (error.code === 4001) {
        throw new Error('Connection rejected by user.');
      } else if (error.code === -32002) {
        throw new Error('Connection request already pending. Please check MetaMask.');
      } else {
        throw new Error(`Failed to connect MetaMask: ${error.message}`);
      }
    }
  }

  /**
   * Check if a Web3 wallet is available in the browser
   */
  static isWalletAvailable(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * Connect to the user's wallet (MetaMask, WalletConnect, etc.)
   */
   static async connectWallet(preferredMethod?: AuthMethod): Promise<WalletConnection> {
    if (preferredMethod === 'metamask') {
      return this.connectWithMetaMask();
    }

    // Default to Web3Auth for better UX
    try {
      return await this.connectWithWeb3Auth(preferredMethod);
    } catch (error) {
      console.warn('Web3Auth connection failed, offering MetaMask as backup:', error);
      
      // If Web3Auth fails and MetaMask is available, offer as backup
      if (this.isMetaMaskAvailable()) {
        throw new Error('Social login failed. You can try MetaMask instead.');
      } else {
        throw error;
      }
    }
  }

  //Get current wallet connection (if any)
  static getCurrentConnection(): WalletConnection | null {
    return this.currentConnection;
  }

  // Check if wallet is currently connected
  static isConnected(): boolean {
    return this.currentConnection !== null;
  }

  // Get user-friendly display info
  static getUserDisplayInfo(): {
    displayName: string;
    identifier: string;
    avatar?: string;
    method: string;
  } | null {
    if (!this.currentConnection) return null;

    const conn = this.currentConnection;
    
    if (conn.authMethod === 'web3auth' && conn.userInfo) {
      return {
        displayName: conn.userInfo.name || conn.userInfo.email || 'Web3Auth User',
        identifier: conn.userInfo.email || conn.address.slice(0, 6) + '...' + conn.address.slice(-4),
        avatar: conn.userInfo.profileImage,
        method: conn.userInfo.typeOfLogin || 'Web3Auth'
      };
    } else {
      return {
        displayName: 'MetaMask User',
        identifier: conn.address.slice(0, 6) + '...' + conn.address.slice(-4),
        method: 'MetaMask'
      };
    }
  }

  // Sign a message with the connected wallet
  static async signMessage(message: string): Promise<string> {
    if (!this.currentConnection) {
      throw new Error('No wallet connected');
    }

    try {
      const signature = await this.currentConnection.signer.signMessage(message);
      console.log('✅ Message signed successfully');
      return signature;
    } catch (error: any) {
      console.error('❌ Message signing failed:', error);
      
      if (error.code === 4001) {
        throw new Error('Signing rejected by user.');
      } else {
        throw new Error(`Failed to sign message: ${error.message}`);
      }
    }
  }

  // Disconnect wallet
  static async disconnect(): Promise<void> {
    try {
      // Disconnect Web3Auth if it was used
      if (this.web3auth && this.currentConnection?.authMethod === 'web3auth') {
        await this.web3auth.logout();
      }

      // Clear all connections
      this.provider = null;
      this.currentConnection = null;
      this.web3authProvider = null;
      
      console.log('🔌 Wallet disconnected');
    } catch (error) {
      console.error('Error during disconnect:', error);
      // Clear state anyway
      this.provider = null;
      this.currentConnection = null;
      this.web3authProvider = null;
    }
  }
  
  // Switch to a specific network
  static async switchNetwork(chainId: number): Promise<void> {
      const networkConfig = SUPPORTED_NETWORKS[chainId];
      if (!networkConfig) {
        throw new Error(`Unsupported network: ${chainId}`);
      }

      if (!this.currentConnection) {
        throw new Error('No wallet connected');
      }

      try {
        if (this.currentConnection.authMethod === 'metamask') {
          // MetaMask network switching
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${chainId.toString(16)}` }],
          });
        } else {
          // Web3Auth doesn't support network switching in the same way
          // User would need to reconnect with different network config
          throw new Error('Please disconnect and reconnect to switch networks with Web3Auth');
        }

        // Update current connection
        if (this.currentConnection) {
          const network = await this.provider!.getNetwork();
          this.currentConnection.chainId = Number(network.chainId);
          this.currentConnection.networkName = networkConfig.name;
        }
      } catch (error: any) {
        if (error.code === 4902) {
          throw new Error(`Network ${networkConfig.name} is not added to your wallet. Please add it manually.`);
        } else {
          throw new Error(`Failed to switch network: ${error.message}`);
        }
      }
    }

  // Get wallet balance in ETH
  static async getBalance(): Promise<string> {
    if (!this.currentConnection) {
      throw new Error('No wallet connected');
    }

    try {
      const balance = await this.currentConnection.provider.getBalance(this.currentConnection.address);
      return ethers.formatEther(balance);
    } catch (error: any) {
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  // Check if current network is supported
  static isSupportedNetwork(): boolean {
    if (!this.currentConnection) return false;
    return this.currentConnection.chainId in SUPPORTED_NETWORKS;
  }

  //Get recommended network for your app
  static getRecommendedNetwork(): NetworkConfig {
    return SUPPORTED_NETWORKS[80001]!; // Polygon Mumbai testnet
  }

  static setupEventListeners(
    onAccountChanged?: (address: string) => void,
    onNetworkChanged?: (chainId: number, networkName: string) => void
  ): void {
    // Only set up MetaMask listeners if using MetaMask
    if (this.currentConnection?.authMethod === 'metamask' && this.isMetaMaskAvailable()) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        console.log('👤 MetaMask account changed:', accounts);
        
        if (accounts.length === 0) {
          // User disconnected or locked wallet
          this.disconnect();
          onAccountChanged?.('');
        } else {
          // Safely get the first account
          const newAddress = accounts[0];
          if (newAddress && this.currentConnection) {
            this.currentConnection.address = newAddress;
            onAccountChanged?.(newAddress);
          }
        }
      });

      window.ethereum.on('chainChanged', (chainId: string) => {
        const numericChainId = parseInt(chainId, 16);
        const networkName = SUPPORTED_NETWORKS[numericChainId]?.name || `Unknown Network (${numericChainId})`;
        
        console.log('🌐 MetaMask network changed:', { chainId: numericChainId, networkName });
        
        if (this.currentConnection) {
          this.currentConnection.chainId = numericChainId;
          this.currentConnection.networkName = networkName;
        }
        
        onNetworkChanged?.(numericChainId, networkName);
      });
    }
    
    // Web3Auth doesn't emit the same events, but we could add custom handling here
  }

  /**
   * Get available authentication methods based on environment
   */
  static getAvailableAuthMethods(): { method: AuthMethod; name: string; description: string; available: boolean }[] {
    return [
      {
        method: 'google',
        name: 'Google',
        description: 'Sign in with your Google account',
        available: true
      },
      {
        method: 'facebook',
        name: 'Facebook',
        description: 'Sign in with your Facebook account',
        available: true
      },
      {
        method: 'email_passwordless',
        name: 'Email',
        description: 'Sign in with your email address',
        available: true
      },
      {
        method: 'twitter',
        name: 'Twitter/X',
        description: 'Sign in with your Twitter account',
        available: true
      },
      {
        method: 'metamask',
        name: 'MetaMask',
        description: 'Connect your MetaMask wallet',
        available: this.isMetaMaskAvailable()
      }
    ];
  }
}

// Type augmentation for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}