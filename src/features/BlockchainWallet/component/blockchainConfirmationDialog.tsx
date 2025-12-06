// src/features/BlockchainWallet/components/BlockchainConfirmationDialog.tsx
// Confirmation dialog shown before any blockchain write transaction.
// Explains what's happening and that it's permanent.

import React, { useState } from 'react';
import { AlertTriangle, Shield, Loader2, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ==================== TYPES ====================

export type TransactionType = 'grantAccess' | 'revokeAccess' | 'registerMember' | 'updateStatus';

export interface TransactionDetails {
  type: TransactionType;
  // For sharing transactions
  recordName?: string;
  receiverEmail?: string;
  receiverAddress?: string;
  role?: string;
  // For member transactions
  walletAddress?: string;
}

export interface BlockchainConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  transaction: TransactionDetails;
  walletOrigin: 'generated' | 'metamask' | 'walletconnect' | 'hardware';
}

type DialogState = 'confirm' | 'signing' | 'success' | 'error';

// ==================== HELPER FUNCTIONS ====================

function getTransactionTitle(type: TransactionType): string {
  switch (type) {
    case 'grantAccess':
      return 'Grant Record Access';
    case 'revokeAccess':
      return 'Revoke Record Access';
    case 'registerMember':
      return 'Register on Blockchain';
    case 'updateStatus':
      return 'Update Member Status';
    default:
      return 'Blockchain Transaction';
  }
}

function getTransactionDescription(transaction: TransactionDetails): string {
  switch (transaction.type) {
    case 'grantAccess':
      return `You are granting ${transaction.receiverEmail || 'a user'} access to "${transaction.recordName || 'a record'}" as ${transaction.role || 'viewer'}.`;
    case 'revokeAccess':
      return `You are revoking access to "${transaction.recordName || 'a record'}".`;
    case 'registerMember':
      return 'You are registering your wallet as a Belrose Health member on the blockchain.';
    case 'updateStatus':
      return 'You are updating your verification status on the blockchain.';
    default:
      return 'You are about to perform a blockchain transaction.';
  }
}

// ==================== COMPONENT ====================

export const BlockchainConfirmationDialog: React.FC<BlockchainConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  transaction,
  walletOrigin,
}) => {
  const [state, setState] = useState<DialogState>('confirm');
  const [error, setError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setState('signing');
    setError('');

    try {
      await onConfirm();
      setState('success');
    } catch (err: any) {
      console.error('Transaction failed:', err);
      setError(err.message || 'Transaction failed');
      setState('error');
    }
  };

  const handleClose = () => {
    setState('confirm');
    setError('');
    setTxHash('');
    onClose();
  };

  const isMetaMask =
    walletOrigin === 'metamask' || walletOrigin === 'walletconnect' || walletOrigin === 'hardware';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={state === 'confirm' ? handleClose : undefined}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-white" />
            <h2 className="text-xl font-semibold text-white">
              {getTransactionTitle(transaction.type)}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Confirm State */}
          {state === 'confirm' && (
            <>
              <p className="text-gray-700 mb-4">{getTransactionDescription(transaction)}</p>

              {/* Permanent Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">This action is permanent</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Blockchain transactions cannot be undone. This permission will be permanently
                      recorded and publicly verifiable.
                    </p>
                  </div>
                </div>
              </div>

              {/* Transaction Details */}
              {transaction.receiverAddress && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-1">Recipient Wallet</p>
                  <p className="text-sm font-mono text-gray-700 break-all">
                    {transaction.receiverAddress}
                  </p>
                </div>
              )}

              {/* Signing Method Info */}
              <div className="bg-blue-50 rounded-lg p-3 mb-6">
                <p className="text-sm text-blue-800">
                  {isMetaMask ? (
                    <>
                      <strong>MetaMask will open</strong> to sign this transaction. Please confirm
                      in your wallet.
                    </>
                  ) : (
                    <>
                      <strong>Auto-signing enabled.</strong> Your generated wallet will sign this
                      transaction automatically.
                    </>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex space-x-3">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleConfirm} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  Confirm & Sign
                </Button>
              </div>
            </>
          )}

          {/* Signing State */}
          {state === 'signing' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isMetaMask ? 'Waiting for signature...' : 'Signing transaction...'}
              </p>
              <p className="text-sm text-gray-600">
                {isMetaMask
                  ? 'Please confirm the transaction in MetaMask'
                  : 'Processing your transaction...'}
              </p>
            </div>
          )}

          {/* Success State */}
          {state === 'success' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <p className="text-lg font-medium text-gray-900 mb-2">Transaction Confirmed!</p>
              <p className="text-sm text-gray-600 mb-4">
                Your transaction has been recorded on the blockchain.
              </p>

              {txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  View on Etherscan
                  <ExternalLink className="w-4 h-4 ml-1" />
                </a>
              )}

              <div className="mt-6">
                <Button onClick={handleClose} className="w-full">
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <p className="text-lg font-medium text-gray-900 mb-2">Transaction Failed</p>
              <p className="text-sm text-red-600 mb-4">{error}</p>

              <div className="flex space-x-3">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={() => setState('confirm')} className="flex-1">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockchainConfirmationDialog;
