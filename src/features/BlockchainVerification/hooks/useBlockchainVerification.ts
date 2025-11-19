// src/hooks/useBlockchainVerification.ts

import { useState, useCallback } from 'react';
import { FileObject, BlockchainVerification } from '@/types/core';
import { BlockchainService } from '../service/blockchainService';

interface UseBlockchainVerificationReturn {
  // State
  isGeneratingHash: boolean;
  isVerifying: boolean;
  verificationError: string | null;

  // Actions
  generateBlockchainVerification: (
    fileObject: FileObject,
    options?: {
      providerSignature?: string;
      signerId?: string;
      network?: string;
    }
  ) => Promise<BlockchainVerification | null>;

  verifyRecordIntegrity: (fileObject: FileObject) => Promise<boolean>;

  getVerificationStatus: (fileObject: FileObject) => {
    status: 'verified' | 'unverified' | 'failed' | 'pending';
    message: string;
    icon: string;
  };

  // Utility
  canUseBlockchainVerification: (fileObject: FileObject) => boolean;
}

export const useBlockchainVerification = (): UseBlockchainVerificationReturn => {
  const [isGeneratingHash, setIsGeneratingHash] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const generateBlockchainVerification = useCallback(
    async (
      fileObject: FileObject,
      options: {
        providerSignature?: string;
        signerId?: string;
        network?: string;
      } = {}
    ): Promise<BlockchainVerification | null> => {
      try {
        setIsGeneratingHash(true);
        setVerificationError(null);

        const verification = await BlockchainService.createBlockchainVerification(
          fileObject,
          options
        );

        console.log('Generated blockchain verification:', verification);
        return verification;
      } catch (error) {
        console.error('Failed to generate blockchain verification:', error);
        setVerificationError(error instanceof Error ? error.message : 'Unknown error');
        return null;
      } finally {
        setIsGeneratingHash(false);
      }
    },
    []
  );

  const verifyRecordIntegrity = useCallback(async (fileObject: FileObject): Promise<boolean> => {
    try {
      setIsVerifying(true);
      setVerificationError(null);

      const isValid = await BlockchainService.verifyRecordIntegrity(fileObject);

      if (!isValid) {
        setVerificationError(
          'Record integrity verification failed - content may have been tampered with'
        );
      }

      return isValid;
    } catch (error) {
      console.error('Failed to verify record integrity:', error);
      setVerificationError(error instanceof Error ? error.message : 'Verification error');
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  const getVerificationStatus = useCallback((fileObject: FileObject) => {
    return BlockchainService.getVerificationStatus(fileObject);
  }, []);

  const canUseBlockchainVerification = useCallback((fileObject: FileObject): boolean => {
    // Show badge for provider records or any record with blockchain verification
    return !!fileObject.blockchainVerification;
  }, []);

  return {
    // State
    isGeneratingHash,
    isVerifying,
    verificationError,

    // Actions
    generateBlockchainVerification,
    verifyRecordIntegrity,
    getVerificationStatus,

    // Utility
    canUseBlockchainVerification,
  };
};
