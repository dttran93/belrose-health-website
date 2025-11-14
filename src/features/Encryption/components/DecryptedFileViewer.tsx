// src/components/DecryptedFileViewer.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Share2, FileInput } from 'lucide-react';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { base64ToArrayBuffer } from '@/utils/dataFormattingUtils';

interface DecryptedFileViewerProps {
  downloadURL: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  isEncrypted: boolean;
  encryptedKey?: string;
  encryptedFileIV?: string; // IV is stored separately in Firestore
}

export function DecryptedFileViewer({
  downloadURL,
  fileName,
  fileType,
  fileSize,
  isEncrypted,
  encryptedKey,
  encryptedFileIV,
}: DecryptedFileViewerProps) {
  const [decryptedFileUrl, setDecryptedFileUrl] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  useEffect(() => {
    async function decryptAndDisplayFile() {
      // If not encrypted, use the URL directly
      if (!isEncrypted || !encryptedKey) {
        setDecryptedFileUrl(downloadURL);
        return;
      }

      setIsDecrypting(true);
      setDecryptError(null);

      try {
        console.log('🔓 Decrypting file for display...');

        // 1. Get the user's master key from session
        const masterKey = EncryptionKeyManager.getSessionKey();
        if (!masterKey) {
          throw new Error('Encryption session not active. Please unlock your encryption.');
        }

        // 2. Decrypt the file's AES key using the master key
        const encryptedKeyData = base64ToArrayBuffer(encryptedKey);
        const fileKeyData = await EncryptionService.decryptKeyWithMasterKey(
          encryptedKeyData,
          masterKey
        );
        const fileKey = await EncryptionService.importKey(fileKeyData);

        // 3. Fetch the encrypted file from Storage
        const response = await fetch(downloadURL);
        if (!response.ok) {
          throw new Error('Failed to fetch encrypted file');
        }
        const encryptedBlob = await response.blob();
        const encryptedArrayBuffer = await encryptedBlob.arrayBuffer();

        // 4. Get the IV from Firestore (stored separately, NOT prepended to file)
        if (!encryptedFileIV) {
          throw new Error('Missing encryption IV for file');
        }
        const iv = base64ToArrayBuffer(encryptedFileIV);

        // 5. Decrypt the file (the entire blob is encrypted data, no IV prefix)
        const decryptedArrayBuffer = await EncryptionService.decryptFile(
          encryptedArrayBuffer,
          fileKey,
          iv
        );

        // 6. Create a blob URL from the decrypted data
        const decryptedBlob = new Blob([decryptedArrayBuffer], {
          type: fileType || 'application/octet-stream',
        });
        const blobUrl = URL.createObjectURL(decryptedBlob);

        setDecryptedFileUrl(blobUrl);
        console.log('✅ File decrypted and ready for display');
      } catch (error) {
        console.error('❌ Decryption failed:', error);
        setDecryptError(error instanceof Error ? error.message : 'Failed to decrypt file');
      } finally {
        setIsDecrypting(false);
      }
    }

    decryptAndDisplayFile();

    // Cleanup: revoke the blob URL when component unmounts
    return () => {
      if (decryptedFileUrl && isEncrypted) {
        URL.revokeObjectURL(decryptedFileUrl);
      }
    };
  }, [downloadURL, isEncrypted, encryptedKey]);

  const handleDownload = async () => {
    if (!decryptedFileUrl) return;

    try {
      const response = await fetch(decryptedFileUrl);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName || 'document';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Original File</h2>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => {
              if (decryptedFileUrl) {
                window.open(decryptedFileUrl, '_blank');
              }
            }}
            disabled={isDecrypting || !decryptedFileUrl}
            className="flex items-center space-x-2"
          >
            <Share2 className="w-4 h-4" />
            <span>{isDecrypting ? 'Decrypting...' : 'Open'}</span>
          </Button>
          <Button
            variant="default"
            onClick={handleDownload}
            disabled={isDecrypting || !decryptedFileUrl}
            className="flex items-center space-x-2"
          >
            <FileInput className="w-4 h-4" />
            <span>{isDecrypting ? 'Decrypting...' : 'Download'}</span>
          </Button>
        </div>
      </div>

      {/* Error message */}
      {decryptError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm font-medium">Decryption Failed</p>
          <p className="text-red-600 text-sm">{decryptError}</p>
        </div>
      )}

      {/* Loading state */}
      {isDecrypting && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-600 text-sm">
            {isEncrypted ? 'Decrypting file...' : 'Loading file...'}
          </p>
        </div>
      )}

      {/* File preview */}
      {decryptedFileUrl && !isDecrypting && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-4">
            <FileInput className="w-6 h-6 text-gray-500" />
            <div>
              <p className="font-medium text-gray-900">{fileName || 'Original Document'}</p>
              <p className="text-sm text-gray-500">
                {fileType} • {fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : 'Unknown size'}
                {isEncrypted && ' • 🔒 Encrypted'}
              </p>
            </div>
          </div>

          {/* Embedded Document Viewer */}
          <div className="border rounded-lg overflow-hidden bg-white">
            {fileType?.includes('image') ? (
              // Image preview
              <img
                src={decryptedFileUrl}
                alt={fileName || 'Document preview'}
                className="w-full max-h-96 object-contain"
              />
            ) : fileType === 'application/pdf' ? (
              // PDF embed
              <iframe
                src={`${decryptedFileUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                className="w-full h-96"
                title={fileName || 'PDF preview'}
              />
            ) : (
              // Fallback for other file types
              <div className="p-8 text-center">
                <FileInput className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Preview not available for this file type</p>
                <p className="text-sm text-gray-500">Click "Open" to view in a new tab</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
