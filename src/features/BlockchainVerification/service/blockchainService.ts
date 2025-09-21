import { ethers } from 'ethers';
import { FileObject, BlockchainVerification } from '@/types/core';
import { removeUndefinedValues } from '@/lib/utils';

// Your deployed contract address
const CONTRACT_ADDRESS = "0x586B5cE24aF93842AB54fd5573B03c740f39387A";

// Contract ABI (simplified - just the functions we need)
const CONTRACT_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "recordHash", "type": "string"},
      {"internalType": "string", "name": "recordId", "type": "string"}
    ],
    "name": "storeRecordHash",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "recordHash", "type": "string"}],
    "name": "verifyRecordExists",
    "outputs": [
      {"internalType": "bool", "name": "exists", "type": "bool"},
      {"internalType": "address", "name": "submitter", "type": "address"},
      {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
      {"internalType": "string", "name": "recordId", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalRecords",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export class BlockchainService {
  
  /**
   * Generate a hash of the medical record content
   */
  static async generateRecordHash(fileObject: FileObject): Promise<string> {
    const hashableContent = {
      // Only Core content that affects record integrity
      fhirData: fileObject.fhirData || null,
      belroseFields: fileObject.belroseFields || null,
      extractedText: fileObject.extractedText || null,
      originalText: fileObject.originalText || null,
      originalFileHash: fileObject.originalFileHash || null,
      // Exclude UI state, timestamps, processing status, etc.
      // as these don't affect the medical content integrity
    };

    // Sort keys to ensure consistent hashing
    const sortedContent = this.sortObjectKeys(hashableContent);
    const contentString = JSON.stringify(sortedContent);
    
    // Use Web Crypto API for proper cryptographic hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(contentString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  }

  /**
   * Actually write to the blockchain!
   */
  static async writeToBlockchain(
    recordHash: string, 
    recordId: string
  ): Promise<string> {
    try {
      // Check if MetaMask is available
      if (!window.ethereum) {
        throw new Error('MetaMask not found. Please install MetaMask to use blockchain features.');
      }

      console.log('🔗 Connecting to wallet...');
      
      // Create provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      console.log('📝 Connected wallet:', await signer.getAddress());

      // Create contract instance
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer) as any;

      console.log('⛓️ Writing to blockchain...', { recordHash: recordHash.substring(0, 12) + '...', recordId });

      // Call the smart contract function
      const transaction = await contract.storeRecordHash(recordHash, recordId);
      
      console.log('⏳ Transaction sent! Hash:', transaction.hash);
      console.log('⏳ Waiting for confirmation...');

      // Wait for the transaction to be mined (confirmed)
      const receipt = await transaction.wait();
      
      console.log('✅ Transaction confirmed!', {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString()
      });

      return receipt.hash; // Return the real transaction hash

    } catch (error: any) {
      console.error('❌ Blockchain write failed:', error);
      
      // Handle specific error types
      if (error.code === 'ACTION_REJECTED') {
        throw new Error('Transaction was rejected by user');
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error('Insufficient funds for transaction. Get testnet ETH from https://sepoliafaucet.com/');
      } else if (error.message?.includes('user rejected')) {
        throw new Error('Transaction was rejected by user');
      } else if (error.message?.includes('MetaMask')) {
        throw new Error('MetaMask connection error: ' + error.message);
      } else {
        throw new Error(`Blockchain error: ${error.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Verify a record exists on the blockchain
   */
  static async verifyRecordOnBlockchain(recordHash: string): Promise<{
    exists: boolean;
    submitter?: string;
    timestamp?: number;
    recordId?: string;
  }> {
    try {
      // Create read-only provider (no wallet needed for reading)
      const provider = new ethers.JsonRpcProvider('https://1rpc.io/sepolia');
      
      // Create contract instance for reading
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider) as any;

      console.log('🔍 Checking blockchain for hash:', recordHash.substring(0, 12) + '...');

      // Call the verification function
      const result = await contract.verifyRecordExists(recordHash);
      
      console.log('📋 Blockchain result:', {
        exists: result[0],
        submitter: result[1],
        timestamp: Number(result[2])
      });

      return {
        exists: result[0],
        submitter: result[1],
        timestamp: Number(result[2]),
        recordId: result[3]
      };

    } catch (error: any) {
      console.error('❌ Blockchain verification failed:', error);
      return { exists: false };
    }
  }

  /**
   * Create blockchain verification - NOW WITH REAL BLOCKCHAIN WRITES!
   */
  static async createBlockchainVerification(
    fileObject: FileObject,
    options: {
      providerSignature?: string;
      signerId?: string;
      network?: string;
    } = {}
  ): Promise<BlockchainVerification> {
    const recordHash = await this.generateRecordHash(fileObject);
    
    try {
      console.log('🚀 Attempting real blockchain write...');
      
      // 🔥 ACTUALLY WRITE TO BLOCKCHAIN!
      const realTxId = await this.writeToBlockchain(recordHash, fileObject.id);
      
      const verification = {
        recordHash,
        blockchainTxId: realTxId, // Real transaction hash!
        providerSignature: options.providerSignature,
        signerId: options.signerId,
        blockchainNetwork: options.network || 'sepolia',
        timestamp: Date.now(),
        isVerified: true // Real verification!
      };
      
      console.log('✅ Real blockchain verification created!', {
        hash: recordHash.substring(0, 12) + '...',
        txId: realTxId
      });
      
      return removeUndefinedValues(verification) as BlockchainVerification;
      
    } catch (error: any) {
      console.error('❌ Real blockchain write failed, falling back to simulation:', error);
      
      // Fall back to simulation if blockchain write fails
      const simulatedTxId = this.generateSimulatedTransactionId();
      
      const verification = {
        recordHash,
        blockchainTxId: simulatedTxId,
        providerSignature: options.providerSignature,
        signerId: options.signerId,
        blockchainNetwork: 'simulated-' + (options.network || 'sepolia'),
        timestamp: Date.now(),
        isVerified: false // Mark as unverified since it's simulated
      };
      
      console.log('⚠️ Using simulated verification due to error:', error.message);
      
      return removeUndefinedValues(verification) as BlockchainVerification;
    }
  }

  /**
   * Verify a record against its blockchain verification
   * Returns true if the current record matches what was originally hashed
   */
  static async verifyRecordIntegrity(fileObject: FileObject): Promise<boolean> {
    if (!fileObject.blockchainVerification) {
      console.warn('No blockchain verification found for record:', fileObject.id);
      return false;
    }

    const currentHash = await this.generateRecordHash(fileObject);
    const storedHash = fileObject.blockchainVerification.recordHash;
    
    // First check if hashes match
    if (currentHash !== storedHash) {
      console.warn('❌ Record hash mismatch:', { currentHash, storedHash });
      return false;
    }

    // If we have a real blockchain transaction, verify it exists on chain
    if (fileObject.blockchainVerification.isVerified && 
        !fileObject.blockchainVerification.blockchainNetwork?.includes('simulated')) {
      try {
        console.log('🔍 Verifying record on blockchain...');
        const chainResult = await this.verifyRecordOnBlockchain(storedHash);
        
        if (chainResult.exists) {
          console.log('✅ Record verified on blockchain!');
          return true;
        } else {
          console.warn('❌ Record not found on blockchain');
          return false;
        }
      } catch (error) {
        console.error('❌ Blockchain verification failed:', error);
        return false;
      }
    }
    
    // For simulated transactions, just check hash match
    console.log('✅ Hash match confirmed (simulated verification)');
    return true;
  }

  /**
   * Check if a record needs blockchain verification
   */
  static needsBlockchainVerification(fileObject: FileObject): boolean {
    return true;
  }

  /**
   * Simulate a blockchain transaction for fallback
   */
  private static generateSimulatedTransactionId(): string {
    // Simulate an Ethereum transaction hash format
    const chars = '0123456789abcdef';
    let result = '0x';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Recursively sort object keys for consistent hashing
   */
  private static sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }
    
    const sortedObj: any = {};
    const sortedKeys = Object.keys(obj).sort();
    
    for (const key of sortedKeys) {
      sortedObj[key] = this.sortObjectKeys(obj[key]);
    }
    
    return sortedObj;
  }

  /**
   * Create a version chain reference
   * Each version should reference the previous version's hash
   */
  static createVersionChain(
    currentVerification: BlockchainVerification,
    previousVerification?: BlockchainVerification
  ): BlockchainVerification {
    return {
      ...currentVerification,
      // Add reference to previous version for audit trail
      previousRecordHash: previousVerification?.recordHash
    };
  }

  /**
   * Validate blockchain verification format
   */
  static isValidBlockchainVerification(verification: BlockchainVerification): boolean {
    return !!(
      verification.recordHash &&
      verification.blockchainTxId &&
      verification.blockchainNetwork &&
      verification.timestamp &&
      typeof verification.isVerified === 'boolean'
    );
  }

  /**
   * Get verification status display info
   */
  static getVerificationStatus(fileObject: FileObject): {
    status: 'verified' | 'unverified' | 'failed' | 'pending';
    message: string;
    icon: string;
  } {
    if (!fileObject.blockchainVerification) {
      if (this.needsBlockchainVerification(fileObject)) {
        return {
          status: 'pending',
          message: 'Blockchain verification pending',
          icon: '⏳'
        };
      } else {
        return {
          status: 'unverified',
          message: 'Self-reported (no verification required)',
          icon: '📝'
        };
      }
    }

    if (fileObject.blockchainVerification.isVerified) {
      return {
        status: 'verified',
        message: 'Blockchain verified',
        icon: '✅'
      };
    } else {
      return {
        status: 'failed',
        message: 'Verification failed',
        icon: '❌'
      };
    }
  }
}