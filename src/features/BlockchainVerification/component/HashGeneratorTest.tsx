import React, { useState, useEffect } from 'react';
import { BlockchainService } from '@/features/BlockchainVerification/service/blockchainService';
import { FileObject } from '@/types/core';
import { Hash, Play, RefreshCw, Copy, Check, AlertCircle, FileText, Users } from 'lucide-react';
import { useCompleteRecords } from '@/features/ViewEditRecord/hooks/useAllUserRecords';

const HashGeneratorTest = () => {
  const [isGeneratingLeft, setIsGeneratingLeft] = useState(false);
  const [isGeneratingRight, setIsGeneratingRight] = useState(false);
  const [leftHash, setLeftHash] = useState('');
  const [rightHash, setRightHash] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const [error, setError] = useState('');
  
  // Get user's records
  const { records, loading: recordsLoading, error: recordsError } = useCompleteRecords();
  
  // Text input data
  const [textInput, setTextInput] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<FileObject | null>(null);

  // Sample text for the input field
  useEffect(() => {
    setTextInput(`Patient: John Doe
Visit Type: Follow-up Appointment
Date: 2024-08-31
Provider: Dr. Smith
Institution: General Hospital

Summary: Patient appears healthy. Blood pressure normal. Continue current medications.

FHIR Data:
{
  "resourceType": "Patient",
  "id": "test-patient-123",
  "name": [{"family": "Doe", "given": ["John"]}],
  "birthDate": "1980-01-01"
}`);
  }, []);

  // Create FileObject from text input
  const createFileObjectFromText = (): FileObject => {
    // Try to extract structured data from the text
    const lines = textInput.split('\n');
    let fhirData = {};
    let belroseFields = {};
    
    // Simple parsing - look for key patterns
    lines.forEach(line => {
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('patient:')) {
        belroseFields = { ...belroseFields, patient: line.split(':')[1]?.trim() };
      } else if (lowerLine.includes('visit type:')) {
        belroseFields = { ...belroseFields, visitType: line.split(':')[1]?.trim() };
      } else if (lowerLine.includes('provider:')) {
        belroseFields = { ...belroseFields, provider: line.split(':')[1]?.trim() };
      } else if (lowerLine.includes('institution:')) {
        belroseFields = { ...belroseFields, institution: line.split(':')[1]?.trim() };
      } else if (lowerLine.includes('date:')) {
        belroseFields = { ...belroseFields, completedDate: line.split(':')[1]?.trim() };
      }
    });

    // Try to extract FHIR data if present
    const fhirMatch = textInput.match(/\{[\s\S]*\}/);
    if (fhirMatch) {
      try {
        fhirData = JSON.parse(fhirMatch[0]);
      } catch (e) {
        console.log('Could not parse FHIR data from text');
      }
    }

    return {
      id: 'text-input-' + Date.now(),
      fileName: 'text-input-record.txt',
      fileSize: textInput.length,
      fileType: 'text/plain',
      status: 'completed' as any,
      fhirData: Object.keys(fhirData).length > 0 ? fhirData : null,
      belroseFields: Object.keys(belroseFields).length > 0 ? belroseFields : undefined,
      extractedText: textInput,
      originalText: textInput,
      wordCount: textInput.split(' ').length,
      documentType: 'manual-input'
    };
  };

  const generateLeftHash = async () => {
    setIsGeneratingLeft(true);
    setError('');
    
    try {
      const fileObject = createFileObjectFromText();
      console.log('Generating hash for text input:', fileObject);
      
      const hash = await BlockchainService.generateRecordHash(fileObject);
      setLeftHash(hash);
      console.log('Generated left hash:', hash);
      
    } catch (err) {
      console.error('Left hash generation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsGeneratingLeft(false);
    }
  };

  const generateRightHash = async () => {
    if (!selectedRecord) {
      setError('Please select a record first');
      return;
    }

    setIsGeneratingRight(true);
    setError('');
    
    try {
      console.log('Generating hash for selected record:', selectedRecord);
      
      const hash = await BlockchainService.generateRecordHash(selectedRecord);
      setRightHash(hash);
      console.log('Generated right hash:', hash);
      
    } catch (err) {
      console.error('Right hash generation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsGeneratingRight(false);
    }
  };

  const generateBothHashes = async () => {
    await Promise.all([generateLeftHash(), generateRightHash()]);
  };

  const copyToClipboard = async (text: string, side: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(side);
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const resetTest = () => {
    setLeftHash('');
    setRightHash('');
    setError('');
    setCopySuccess('');
  };

  const hashesMatch = leftHash && rightHash && leftHash === rightHash;
  const bothHashesGenerated = leftHash && rightHash;

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Hash className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Hash Comparison Tool</h1>
      </div>

      {/* Control Panel */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex gap-3 justify-center">
          <button
            onClick={generateBothHashes}
            disabled={isGeneratingLeft || isGeneratingRight || !selectedRecord || !textInput.trim()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {(isGeneratingLeft || isGeneratingRight) ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Generate Both Hashes
          </button>

          <button
            onClick={resetTest}
            className="inline-flex items-center gap-2 px-4 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-red-800 font-medium">Error:</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Hash Comparison Result */}
      {bothHashesGenerated && (
        <div className="mb-6">
          <div className={`p-4 rounded-lg border-2 ${hashesMatch ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <h3 className={`font-medium mb-2 ${hashesMatch ? 'text-green-800' : 'text-red-800'}`}>
              Hash Comparison Result:
            </h3>
            {hashesMatch ? (
              <div className="flex items-center gap-2 text-green-700">
                <Check className="w-5 h-5" />
                <span className="font-medium">Hashes Match!</span>
                <span className="text-sm text-green-600">The content is identical</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Hashes Don't Match</span>
                <span className="text-sm text-red-600">The content is different</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column - Text Input */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-medium text-gray-900">Text Input</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter medical record content:
              </label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Enter medical record content here..."
                className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm font-mono"
              />
            </div>

            <button
              onClick={generateLeftHash}
              disabled={isGeneratingLeft || !textInput.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGeneratingLeft ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Hash className="w-4 h-4" />
              )}
              Generate Hash from Text
            </button>

            {/* Left Hash Display */}
            {leftHash && (
              <div className="p-3 bg-white border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">Text Hash:</h4>
                  <button
                    onClick={() => copyToClipboard(leftHash, 'left')}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition-colors"
                  >
                    {copySuccess === 'left' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copySuccess === 'left' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="font-mono text-xs bg-gray-100 p-2 rounded break-all">
                  {leftHash}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Record Selection */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-medium text-gray-900">Your Records</h2>
          </div>

          <div className="space-y-4">
            {recordsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-600">Loading records...</span>
              </div>
            ) : recordsError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                Error loading records: {recordsError.message || "Unknown error occured"}
              </div>
            ) : records.length === 0 ? (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
                No records found. Upload some records first!
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select a record to compare:
                </label>
                <select
                  value={selectedRecord?.id || ''}
                  onChange={(e) => {
                    const record = records.find(r => r.id === e.target.value);
                    setSelectedRecord(record || null);
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Select a record...</option>
                  {records.map(record => (
                    <option key={record.id} value={record.id}>
                      {record.belroseFields?.title || record.fileName} 
                      {record.belroseFields?.completedDate && ` (${record.belroseFields.completedDate})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedRecord && (
              <div className="p-3 bg-white border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Selected Record:</h4>
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Title:</span> {selectedRecord.belroseFields?.title || selectedRecord.fileName}</p>
                  <p><span className="font-medium">Type:</span> {selectedRecord.belroseFields?.visitType || 'Unknown'}</p>
                  <p><span className="font-medium">Provider:</span> {selectedRecord.belroseFields?.provider || 'Unknown'}</p>
                  <p><span className="font-medium">Date:</span> {selectedRecord.belroseFields?.completedDate || 'Unknown'}</p>
                </div>
              </div>
            )}

            <button
              onClick={generateRightHash}
              disabled={isGeneratingRight || !selectedRecord}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGeneratingRight ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Hash className="w-4 h-4" />
              )}
              Generate Hash from Record
            </button>

            {/* Right Hash Display */}
            {rightHash && (
              <div className="p-3 bg-white border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">Record Hash:</h4>
                  <button
                    onClick={() => copyToClipboard(rightHash, 'right')}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-sm rounded hover:bg-green-200 transition-colors"
                  >
                    {copySuccess === 'right' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copySuccess === 'right' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="font-mono text-xs bg-gray-100 p-2 rounded break-all">
                  {rightHash}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Information Panel */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">How to Use This Tool:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Left side:</strong> Enter or paste medical record content as text</li>
          <li>• <strong>Right side:</strong> Select one of your existing records from the dropdown</li>
          <li>• Click "Generate Both Hashes" to create hashes for both sides</li>
          <li>• The tool will tell you if the hashes match (meaning identical content)</li>
          <li>• Try copying content from a record and pasting it in the text field to test</li>
          <li>• Small changes in content will result in completely different hashes</li>
        </ul>
      </div>
    </div>
  );
};

export default HashGeneratorTest;