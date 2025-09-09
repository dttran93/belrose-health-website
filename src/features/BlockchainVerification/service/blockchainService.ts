import { FileObject, BlockchainVerification } from '@/types/core';
import { removeUndefinedValues } from '@/lib/utils';

export class BlockchainService {
  
  static async generateRecordHash(fileObject: FileObject): Promise<string> {
    const hashableContent = {
      //Only Core content that affects record integrity
      fhirData: fileObject.fhirData || null,
      belroseFields: fileObject.belroseFields || null,
      extractedText: fileObject.extractedText || null,
      originalText: fileObject.originalText || null,
      
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
   * Create blockchain verification object for a new record
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
  
  // For Phase 1, we'll simulate blockchain transaction
  const simulatedTxId = this.generateSimulatedTransactionId();
  
  const baseVerification = {
    recordHash,
    blockchainTxId: simulatedTxId,
    providerSignature: options.providerSignature,
    signerId: options.signerId,
    blockchainNetwork: options.network || 'ethereum-testnet',
    timestamp: Date.now(),
    isVerified: true
  };
  
  // Use the utility function instead of duplicating logic
  return removeUndefinedValues(baseVerification) as BlockchainVerification;
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
    
    return currentHash === storedHash;
  }

  /**
   * Check if a record needs blockchain verification
   * Provider records always need it, patient records are optional
   */
  static needsBlockchainVerification(fileObject: FileObject): boolean {
    // For the timebeing just set all as needs BlockchianVerification, but probably need to adjust this eventually
    return true;
  }

  /**
   * Simulate a blockchain transaction for Phase 1
   * In Phase 2, this will be replaced with real blockchain calls
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