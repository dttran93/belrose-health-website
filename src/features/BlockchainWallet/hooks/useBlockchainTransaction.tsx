// src/features/BlockchainWallet/hooks/useBlockchainTransaction.tsx
// Custom hook for handling blockchain transactions. Brings together service, and dialog box.
// Provides a simple API for components to trigger blockchain writes.

import React, { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import {
  BlockchainConfirmationDialog,
  TransactionDetails,
} from '../component/blockchainConfirmationDialog';
import { WalletService } from '../services/walletService';
import { WalletOrigin } from '@/types/core';

// ==================== TYPES ====================

interface TransactionRequest {
  transaction: TransactionDetails;
  onConfirm: () => Promise<{ txHash?: string }>;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

interface BlockchainTransactionContextType {
  //Request a blockchain transaction with confirmation dialog
  requestTransaction: (request: TransactionRequest) => void;

  //Check if user can sign transactions
  canSign: () => Promise<{ canSign: boolean; reason?: string; walletOrigin?: WalletOrigin }>;

  //Whether a transaction is currently in progress
  isTransacting: boolean;
}

// ==================== CONTEXT ====================

const BlockchainTransactionContext = createContext<BlockchainTransactionContextType | null>(null);

// ==================== PROVIDER ====================

interface BlockchainTransactionProviderProps {
  children: ReactNode;
}

export const BlockchainTransactionProvider: React.FC<BlockchainTransactionProviderProps> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTransacting, setIsTransacting] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<TransactionRequest | null>(null);
  const [walletOrigin, setWalletOrigin] = useState<WalletOrigin>('generated');

  const requestTransaction = useCallback(async (request: TransactionRequest) => {
    // Check if user can sign first
    const signCheck = await WalletService.canSign();

    if (!signCheck.canSign) {
      // Can't sign - call error handler immediately
      request.onError?.(new Error(signCheck.reason || 'Cannot sign transactions'));
      return;
    }

    setWalletOrigin(signCheck.walletOrigin || 'generated');
    setCurrentRequest(request);
    setIsOpen(true);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!currentRequest) return;

    setIsTransacting(true);

    try {
      const result = await currentRequest.onConfirm();
      currentRequest.onSuccess?.(result);
    } catch (error) {
      currentRequest.onError?.(error as Error);
      throw error; // Re-throw so dialog shows error state
    } finally {
      setIsTransacting(false);
    }
  }, [currentRequest]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setCurrentRequest(null);
  }, []);

  const canSign = useCallback(async () => {
    return WalletService.canSign();
  }, []);

  return (
    <BlockchainTransactionContext.Provider
      value={{
        requestTransaction,
        canSign,
        isTransacting,
      }}
    >
      {children}

      {currentRequest && (
        <BlockchainConfirmationDialog
          isOpen={isOpen}
          onClose={handleClose}
          onConfirm={handleConfirm}
          transaction={currentRequest.transaction}
          walletOrigin={walletOrigin}
        />
      )}
    </BlockchainTransactionContext.Provider>
  );
};

// ==================== HOOK ====================

/**
 * Hook to trigger blockchain transactions with confirmation dialog
 *
 * @example
 * ```tsx
 * const { requestTransaction, canSign } = useBlockchainTransaction();
 *
 * const handleShare = async () => {
 *   requestTransaction({
 *     transaction: {
 *       type: 'grantAccess',
 *       recordName: 'My Health Record',
 *       receiverEmail: 'user@example.com',
 *       role: 'viewer',
 *     },
 *     onConfirm: async () => {
 *       const result = await SharingContractService.grantAccessOnChain(...);
 *       return { txHash: result.txHash };
 *     },
 *     onSuccess: (result) => {
 *       toast.success('Access granted!');
 *     },
 *     onError: (error) => {
 *       toast.error(error.message);
 *     },
 *   });
 * };
 * ```
 */
export const useBlockchainTransaction = (): BlockchainTransactionContextType => {
  const context = useContext(BlockchainTransactionContext);

  if (!context) {
    throw new Error('useBlockchainTransaction must be used within a BlockchainTransactionProvider');
  }

  return context;
};

// ==================== STANDALONE HELPER ====================

/**
 * For use outside of React components (e.g., in services)
 * Returns a promise that resolves when user confirms or rejects when they cancel
 *
 * Note: This requires the BlockchainTransactionProvider to be mounted in the app.
 * For service-level usage, consider passing the confirmation function as a parameter.
 */
export async function confirmBlockchainTransaction(
  transaction: TransactionDetails
): Promise<boolean> {
  // This is a placeholder - in practice, you'd use the hook version
  // or implement a standalone modal system
  return new Promise(resolve => {
    const confirmed = window.confirm(
      `Blockchain Transaction: ${transaction.type}\n\n` +
        `This action is permanent and will be recorded on the blockchain.\n\n` +
        `Continue?`
    );
    resolve(confirmed);
  });
}
