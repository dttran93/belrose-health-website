// src/features/Encryption/hooks/useEncryption.ts
import { useState, useCallback } from 'react';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { isEncryptionEnabled, measurePerformance } from '@/features/Encryption/encryptionConfig';

interface CompleteRecordEncryption {
  fileName: {
    encrypted: ArrayBuffer;
    iv: string;
  };
  file?: {
    encrypted: ArrayBuffer;
    iv: string;
  };
  extractedText: {
    encrypted: ArrayBuffer;
    iv: string;
  };
  originalText?: {
    encrypted: ArrayBuffer;
    iv: string;
  };
  fhirData?: {
    encrypted: ArrayBuffer;
    iv: string;
  };
  belroseFields?: {
    encrypted: ArrayBuffer;
    iv: string;
  };
  customData?: {
    encrypted: ArrayBuffer;
    iv: string;
  };
  encryptedKey: string;
}

interface UseEncryptionReturn {
  encryptCompleteRecord: (
    fileName: string,
    file: File | undefined,
    extractedText: string,
    originalText: string | undefined,
    fhirData: any | null,
    belroseFields: any | null,
    customData: any | null
  ) => Promise<CompleteRecordEncryption | null>;

  decryptCompleteRecord: (
    encryptedKey: string,
    encryptedData: any
  ) => Promise<{
    file?: ArrayBuffer;
    extractedText: string;
    originalText?: string;
    fhirData?: any;
    belroseFields?: any;
  } | null>;

  isEncrypting: boolean;
  isDecrypting: boolean;
  isEnabled: boolean;
  error: Error | null;
}

export function useEncryption(): UseEncryptionReturn {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const encryptCompleteRecord = useCallback(
    async (
      fileName: string,
      file: File | undefined,
      extractedText: string,
      originalText: string | undefined,
      fhirData: any | null,
      belroseFields: any | null,
      customData: any | null
    ): Promise<CompleteRecordEncryption | null> => {
      // Check if encryption is enabled
      if (!isEncryptionEnabled()) {
        console.log('ℹ️ Encryption is disabled - skipping encryption');
        return null;
      }

      setIsEncrypting(true);
      setError(null);

      try {
        const result = await measurePerformance('Complete Record Encryption', async () => {
          return await EncryptionService.encryptCompleteRecord(
            fileName,
            file,
            extractedText,
            originalText,
            fhirData,
            belroseFields,
            customData
          );
        });

        console.log('✅ Complete record encryption successful');
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Encryption failed');
        console.error('❌ Encryption error:', error);
        setError(error);
        throw error;
      } finally {
        setIsEncrypting(false);
      }
    },
    []
  );

  const decryptCompleteRecord = useCallback(
    async (encryptedKey: string, encryptedData: any): Promise<any> => {
      // If encryption is disabled, data shouldn't be encrypted
      if (!isEncryptionEnabled()) {
        console.log('ℹ️ Encryption is disabled - returning data as-is');
        return encryptedData;
      }

      setIsDecrypting(true);
      setError(null);

      try {
        const result = await measurePerformance('Complete Record Decryption', async () => {
          return await EncryptionService.decryptCompleteRecord(encryptedKey, encryptedData);
        });

        console.log('✅ Complete record decryption successful');
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Decryption failed');
        console.error('❌ Decryption error:', error);
        setError(error);
        throw error;
      } finally {
        setIsDecrypting(false);
      }
    },
    []
  );

  return {
    encryptCompleteRecord,
    decryptCompleteRecord,
    isEncrypting,
    isDecrypting,
    isEnabled: isEncryptionEnabled(),
    error,
  };
}
