// src/features/Sharing/components/SharingBlockchainVerification.tsx

import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Database,
  Blocks,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SharingContractService } from '@/features/BlockchainVerification/service/sharingContractService';
import { AccessPermissionData } from '../services/sharingService';

interface SharingBlockchainVerificationProps {
  permissionHash: string;
  firestoreData: AccessPermissionData;
}

interface BlockchainData {
  sharer: string;
  receiver: string;
  recordId: string;
  isActive: boolean;
  grantedAt: number;
  revokedAt: number;
}

export const SharingBlockchainVerification: React.FC<SharingBlockchainVerificationProps> = ({
  permissionHash,
  firestoreData,
}) => {
  const [blockchainData, setBlockchainData] = useState<BlockchainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBlockchainData = async () => {
    setRefreshing(true);
    setError(null);

    try {
      const data = await SharingContractService.checkAccessOnChain(permissionHash);
      setBlockchainData(data);
    } catch (err) {
      console.error('Failed to fetch blockchain data:', err);
      setError('Failed to verify on blockchain');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBlockchainData();
  }, [permissionHash]);

  const formatDate = (timestamp: number | Date) => {
    const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : timestamp;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const checkMatch = (firestoreValue: any, blockchainValue: any) => {
    if (typeof firestoreValue === 'string' && typeof blockchainValue === 'string') {
      return firestoreValue.toLowerCase() === blockchainValue.toLowerCase();
    }
    return firestoreValue === blockchainValue;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-gray-600">Verifying on blockchain...</span>
        </div>
      </div>
    );
  }

  if (error || !blockchainData) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <div className="flex items-center gap-2 text-red-600 mb-4">
          <XCircle className="w-5 h-5" />
          <span className="font-semibold">Blockchain Verification Failed</span>
        </div>
        <p className="text-gray-600 mb-4">{error || 'Unable to fetch blockchain data'}</p>
        <Button onClick={fetchBlockchainData} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Try Again
        </Button>
      </div>
    );
  }

  // Check if all fields match
  const sharerMatch = checkMatch(firestoreData.sharerWalletAddress, blockchainData.sharer);
  const receiverMatch = checkMatch(firestoreData.receiverWalletAddress, blockchainData.receiver);
  const recordIdMatch = checkMatch(firestoreData.recordId, blockchainData.recordId);
  const statusMatch = firestoreData.isActive === blockchainData.isActive;
  const grantedAtMatch =
    Math.abs(firestoreData.grantedAt.getTime() / 1000 - blockchainData.grantedAt) < 5; // Within 5 seconds

  const allMatch = sharerMatch && receiverMatch && recordIdMatch && statusMatch && grantedAtMatch;

  const MatchIcon = ({ matches }: { matches: boolean }) =>
    matches ? (
      <CheckCircle className="w-5 h-5 text-green-600" />
    ) : (
      <XCircle className="w-5 h-5 text-red-600" />
    );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Blockchain Verification</h3>
        </div>
        <Button
          onClick={fetchBlockchainData}
          disabled={refreshing}
          className="text-sm"
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Belrose Database Card */}
        <div className="border border-chart-4/50 rounded-lg p-4 bg-supplement-1">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">
              <Database />
            </span>
            <h4 className="font-semibold text-gray-900">Belrose Database</h4>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Sharer:</div>
              <div className="font-mono text-sm text-gray-900">
                {firestoreData.sharerWalletAddress}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Receiver:</div>
              <div className="font-mono text-sm text-gray-900">
                {firestoreData.receiverWalletAddress}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Record ID:</div>
              <div className="font-mono text-sm text-gray-900 truncate">
                {firestoreData.recordId}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Status:</div>
              <div className="text-sm">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    firestoreData.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {firestoreData.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Granted:</div>
              <div className="text-sm text-gray-900">{formatDate(firestoreData.grantedAt)}</div>
            </div>
          </div>
        </div>

        {/* Blockchain Card */}
        <div className="border border-accent rounded-lg p-4 bg-supplement-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">
              <Blocks />
            </span>
            <h4 className="font-semibold text-gray-900">Blockchain</h4>
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Sharer:</div>
                <div className="font-mono text-sm text-gray-900">{blockchainData.sharer}</div>
              </div>
              <MatchIcon matches={sharerMatch} />
            </div>

            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Receiver:</div>
                <div className="font-mono text-sm text-gray-900">{blockchainData.receiver}</div>
              </div>
              <MatchIcon matches={receiverMatch} />
            </div>

            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Record ID:</div>
                <div className="font-mono text-sm text-gray-900 truncate">
                  {blockchainData.recordId}
                </div>
              </div>
              <MatchIcon matches={recordIdMatch} />
            </div>

            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Status:</div>
                <div className="text-sm">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      blockchainData.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {blockchainData.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <MatchIcon matches={statusMatch} />
            </div>

            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Granted:</div>
                <div className="text-sm text-gray-900">{formatDate(blockchainData.grantedAt)}</div>
              </div>
              <MatchIcon matches={grantedAtMatch} />
            </div>
          </div>
        </div>
      </div>

      {/* Verification Status */}
      <div
        className={`rounded-lg p-4 ${
          allMatch ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          {allMatch ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-900">
                All fields verified on blockchain
              </span>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold text-yellow-900">Verification mismatch detected</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium">📍 Transaction:</span>{' '}
            <span className="font-mono">{firestoreData.blockchainTxHash}</span>
          </div>

          <a
            href={`https://sepolia.etherscan.io/tx/${firestoreData.blockchainTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
          >
            <span>View on Etherscan</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
