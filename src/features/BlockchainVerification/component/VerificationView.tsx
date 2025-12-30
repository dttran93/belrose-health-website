import React, { useState } from 'react';
import { FileObject } from '@/types/core';
import { RecordHashService } from '@/features/ViewEditRecord/services/generateRecordHash';
import {
  ArrowLeft,
  Shield,
  Hash,
  Calendar,
  User,
  Network,
  Copy,
  Check,
  AlertCircle,
  Play,
  RefreshCw,
  Info,
  ExternalLink,
} from 'lucide-react';

interface VerificationViewProps {
  record: FileObject;
  onBack: () => void;
}

export const VerificationView: React.FC<VerificationViewProps> = ({ record, onBack }) => {
  const [copySuccess, setCopySuccess] = useState<string>('');
  const [isGeneratingHash, setIsGeneratingHash] = useState(false);
  const [newlyGeneratedHash, setNewlyGeneratedHash] = useState<string>('');
  const [error, setError] = useState<string>('');

  const recordHash = record.recordHash;

  console.log('active record', { record }, 'record hash', { recordHash });

  // Generate a new hash for comparison
  const generateNewHash = async () => {
    setIsGeneratingHash(true);
    setError('');

    try {
      const hash = await RecordHashService.generateRecordHash(record);
      setNewlyGeneratedHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate hash');
    } finally {
      setIsGeneratingHash(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5" />
              <div>
                <h1 className="text-xl font-semibold">Verification Details</h1>
              </div>
            </div>
            <button
              onClick={onBack}
              className="p-2 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Record Hash Always Present*/}
        <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg max-w mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-blue-800">Record Hash</span>
            <button
              onClick={() => copyToClipboard(newlyGeneratedHash, 'previewHash')}
              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
            >
              {copySuccess === 'previewHash' ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="font-mono text-sm break-all text-blue-900 bg-white p-3 rounded border mb-3">
            {recordHash}
          </p>
        </div>

        <div className="space-y-8">
          {/* Error Display */}
          {error && (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-red-800 font-medium">Error:</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-10 h-10 text-gray-400" />
              </div>
              <h2 className="text-2xl font-medium text-gray-900 mb-4">
                No Blockchain Verification
              </h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                This record doesn't have blockchain verification yet. Generate a hash preview to see
                what verification would look like.
              </p>
            </div>
          </div>

          {/* Information Panel */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-blue-900 font-medium mb-3 text-lg">How Verification Works</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ul className="text-sm text-blue-800 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      The hash is a unique fingerprint of your medical record content
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      If the content changes, the hash will be completely different
                    </li>
                  </ul>
                  <ul className="text-sm text-blue-800 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      Blockchain verification proves the record hasn't been tampered with
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      Provider records require verification, self-reported records are optional
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
