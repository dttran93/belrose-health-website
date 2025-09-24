import React, { useState } from 'react';
import { FileObject, BlockchainVerification } from '@/types/core';
import { useBlockchainVerification } from '@/features/BlockchainVerification/hooks/useBlockchainVerification';
import { BlockchainService } from '@/features/BlockchainVerification/service/blockchainService';
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
  ExternalLink
} from 'lucide-react';

interface VerificationViewProps {
  record: FileObject;
  onBack: () => void;
}

export const VerificationView: React.FC<VerificationViewProps> = ({
  record,
  onBack
}) => {
  const [copySuccess, setCopySuccess] = useState<string>('');
  const [isGeneratingHash, setIsGeneratingHash] = useState(false);
  const [newlyGeneratedHash, setNewlyGeneratedHash] = useState<string>('');
  const [error, setError] = useState<string>('');

  const { getVerificationStatus } = useBlockchainVerification();
  
  const verification = record.blockchainVerification;
  const status = getVerificationStatus(record);

  const recordHash = record.recordHash

  console.log("active record", {record},
  "record hash", {recordHash});

  // Generate a new hash for comparison
  const generateNewHash = async () => {
    setIsGeneratingHash(true);
    setError('');
    
    try {
      const hash = await BlockchainService.generateRecordHash(record);
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
              {copySuccess === 'previewHash' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="font-mono text-sm break-all text-blue-900 bg-white p-3 rounded border mb-3">
            {newlyGeneratedHash}
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

          {/* Main Content */}
          {verification ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Left Column - Verification Info */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2 mb-6">
                    <Shield className="w-5 h-5" />
                    Blockchain Verification
                  </h3>

                  <div className="space-y-6">
                    {/* Network */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Network className="w-5 h-5 text-gray-600" />
                        <span className="font-medium text-gray-700">Network</span>
                      </div>
                      <p className="text-gray-900 font-mono">{verification.blockchainNetwork}</p>
                    </div>

                    {/* Transaction ID */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-5 h-5 text-gray-600" />
                          <span className="font-medium text-gray-700">Transaction ID</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(verification.blockchainTxId, 'txId')}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
                        >
                          {copySuccess === 'txId' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-gray-900 font-mono text-sm break-all bg-white p-3 rounded border">
                        {verification.blockchainTxId}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-5 h-5 text-gray-600" />
                        <span className="font-medium text-gray-700">Recorded At</span>
                      </div>
                      <p className="text-gray-900">{formatDate(verification.timestamp)}</p>
                    </div>

                    {/* Signer */}
                    {verification.signerId && (
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-5 h-5 text-gray-600" />
                          <span className="font-medium text-gray-700">Signed By</span>
                        </div>
                        <p className="text-gray-900">{verification.signerId}</p>
                      </div>
                    )}

                    {/* Provider Signature */}
                    {verification.providerSignature && (
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-gray-600" />
                            <span className="font-medium text-gray-700">Provider Signature</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(verification.providerSignature!, 'signature')}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
                          >
                            {copySuccess === 'signature' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-gray-900 font-mono text-sm break-all bg-white p-3 rounded border">
                          {verification.providerSignature}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Hash Information */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                      <Hash className="w-5 h-5" />
                      Content Hash
                    </h3>
                    <button
                      onClick={generateNewHash}
                      disabled={isGeneratingHash}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isGeneratingHash ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      {isGeneratingHash ? 'Generating...' : 'Generate Current Hash'}
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Original Hash */}
                    {recordHash && ( 
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-green-800">Original Hash (Blockchain)</span>
                        <button
                          onClick={() => copyToClipboard(recordHash, 'originalHash')}
                          className="p-2 text-green-600 hover:text-green-700 hover:bg-green-100 rounded transition-colors"
                        >
                          {copySuccess === 'originalHash' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="font-mono text-sm break-all text-green-900 bg-white p-3 rounded border">
                        {recordHash}
                      </p>
                    </div>
                    )}

                    {/* Current Hash (if generated) */}
                    {newlyGeneratedHash && (
                      <div className={`p-4 border rounded-lg ${
                        newlyGeneratedHash === recordHash 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`font-medium ${
                            newlyGeneratedHash === recordHash 
                              ? 'text-green-800' 
                              : 'text-red-800'
                          }`}>
                            Current Hash
                          </span>
                          <button
                            onClick={() => copyToClipboard(newlyGeneratedHash, 'currentHash')}
                            className={`p-2 rounded transition-colors ${
                              newlyGeneratedHash === recordHash 
                                ? 'text-green-600 hover:text-green-700 hover:bg-green-100' 
                                : 'text-red-600 hover:text-red-700 hover:bg-red-100'
                            }`}
                          >
                            {copySuccess === 'currentHash' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className={`font-mono text-sm break-all bg-white p-3 rounded border ${
                          newlyGeneratedHash === recordHash 
                            ? 'text-green-900' 
                            : 'text-red-900'
                        }`}>
                          {newlyGeneratedHash}
                        </p>
                        
                        {/* Hash Comparison Result */}
                        <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${
                          newlyGeneratedHash === recordHash 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {newlyGeneratedHash === recordHash ? (
                            <>
                              <Check className="w-5 h-5 flex-shrink-0" />
                              <div>
                                <p className="font-medium">Hashes Match</p>
                                <p className="text-sm opacity-90">Content is verified and hasn't been modified</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-5 h-5 flex-shrink-0" />
                              <div>
                                <p className="font-medium">Hashes Don't Match</p>
                                <p className="text-sm opacity-90">Content may have been modified since verification</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* No Verification Present */
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-10 h-10 text-gray-400" />
                </div>
                <h2 className="text-2xl font-medium text-gray-900 mb-4">No Blockchain Verification</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  This record doesn't have blockchain verification yet. Generate a hash preview to see what verification would look like.
                </p>

              </div>
            </div>
          )}

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