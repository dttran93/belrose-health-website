// src/features/Auth/components/RecoveryKeyDisplay.tsx

import React, { useState } from 'react';
import { AlertCircle, Download, Copy, RotateCcwKey } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

interface RecoveryKeyDisplayProps {
  recoveryKey: string;
  onAcknowledge: (acknowledged: boolean) => void;
  onComplete: () => void;
  isCompleted: boolean;
  isActivated: boolean;
}

export const RecoveryKeyDisplay: React.FC<RecoveryKeyDisplayProps> = ({
  recoveryKey,
  onAcknowledge,
  onComplete,
  isCompleted = false,
  isActivated = false,
}) => {
  const [acknowledged, setAcknowledged] = useState(isCompleted);

  const handleCopy = () => {
    navigator.clipboard.writeText(recoveryKey);
    toast.success('Recovery key copied to clipboard');
  };

  const handleDownload = () => {
    const blob = new Blob(
      [
        'Belrose Health Records - Encryption Recovery Key\n\n',
        'IMPORTANT: Store this recovery key in a safe place.\n',
        'If you forget your encryption password, this is the ONLY way to recover your data.\n\n',
        'Recovery Key:\n',
        recoveryKey,
        '\n\nDate Generated: ',
        new Date().toISOString(),
      ],
      { type: 'text/plain' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `belrose-recovery-key-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Recovery key downloaded');
  };

  const handleCheckboxChange = (checked: boolean) => {
    setAcknowledged(checked);
    onAcknowledge(checked);
  };

  const handleComplete = () => {
    if (!acknowledged) {
      toast.error('Please confirm you have saved your recovery key');
      return;
    }
    onComplete();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
          <RotateCcwKey className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Save Your Recovery Key</h2>
        <p className="text-gray-600 mt-2">
          This 24-word recovery key is the ONLY way to recover your data if you forget your
          password.
        </p>
      </div>

      {/* Pre-Activation Info Box*/}
      {!isActivated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-900 flex-1">
              <p className="mb-2">
                Create your Belrose Account (Step 1) to receive your Recovery Key.
              </p>
            </div>
          </div>
        </div>
      )}

      {isActivated && (
        <>
          {/* Recovery Key Display */}
          <div className="bg-gray-50 border rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2 font-medium">Your Recovery Key:</p>
            <div className="bg-white border rounded p-3 font-mono text-sm break-all mb-3">
              {recoveryKey}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 border rounded hover:bg-gray-50"
              >
                <Copy className="w-4 h-4" />
                <span>Copy</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 border rounded hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* Storage Recommendations */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-900 mb-2">Recommended storage:</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Password manager (1Password, Bitwarden)</li>
              <li>• Write down and store in a safe</li>
              <li>• Encrypted cloud storage</li>
            </ul>
          </div>
        </>
      )}

      {recoveryKey && (
        <>
          {/* Acknowledgment */}
          <div className="flex justify-between items-center">
            <input
              type="checkbox"
              checked={acknowledged || isCompleted}
              onChange={e => handleCheckboxChange(e.target.checked)}
              className="m-2 w-6 h-6 cursor-pointer"
            />
            <label
              className={`flex items-start space-x-3 cursor-pointer p-3 rounded-lg ${
                isCompleted ? 'bg-green-50 border-green-500 border-2' : 'border hover:bg-gray-50'
              }`}
            >
              <span className="text-sm">
                <span className="block p-1">
                  <b>I acknowledge that:</b>
                </span>
                <span className="block p-1">
                  I have saved my recovery key in a secure location.
                </span>
                <span className="block p-1">
                  Without this key, I cannot recover my data if I forget my password.
                </span>
                <span className="block p-1">
                  Belrose cannot access encryption passwords or recovery keys.
                </span>
              </span>
            </label>
          </div>

          {/* Complete Button */}
          <Button onClick={handleComplete} disabled={!acknowledged} className="w-full py-3">
            Complete Registration
          </Button>
        </>
      )}
    </div>
  );
};
