//src/features/AddRecord/hooks/useRecordProcessing.ts

/**
 * This hook orchestrates the full processing flow for a file.
 * It handles: extracting text, FHIR conversion, AI processing, hashing, encryption and metadata
 * generation. It also reports stages for the UI progress.
 *
 * This hook does NOT create file objects or upload them. That's in 'useFileManager', which calls this hook
 * to process each file after creating the initial FileObject.
 *
 * Flow:
 * CombinedUploadFHIR --> useFileManager --> useRecordProcessing --> documentProcessorService
 */

import { toast } from 'sonner';
import DocumentProcessorService from '../services/documentProcessorService';
import { convertToFHIR } from '../services/fhirConversionService';
import { createBelroseFields } from '../services/belroseFieldsService';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { measurePerformance, logEncryption } from '@/features/Encryption/encryptionConfig';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { FileObject, VirtualFileInput, BelroseFields, ProcessingStages } from '@/types/core';
import {
  RecordHashService,
  HashableFileContent,
} from '@/features/ViewEditRecord/services/generateRecordHash';

export interface ProcessedRecord {
  extractedText?: string | null;
  wordCount?: number;
  fhirData?: any;
  belroseFields?: BelroseFields;
  recordHash?: string;
  encryptedData?: any;
  aiProcessingStatus?: 'completed' | 'failed' | 'not_needed';
  contextText?: string;
}

export interface ProcessingCallbacks {
  onStageUpdate?: (stage: ProcessingStages, data?: Partial<FileObject>) => void;
  onError?: (error: Error) => void;
}

export class CombinedRecordProcessingService {
  /**
   * Process an uploaded file through the complete pipeline:
   * 1. Extract text
   * 2. Convert to FHIR
   * 3. AI processing
   * 4. Generate record hash
   * 5. Encrypt
   */
  static async processUploadedFile(
    fileObj: FileObject,
    callbacks?: ProcessingCallbacks
  ): Promise<ProcessedRecord> {
    const { onStageUpdate, onError } = callbacks || {};
    const result: ProcessedRecord = {};

    try {
      // STEP 1: Extract text
      console.log(`📝 Step 1: Extracting text from: ${fileObj.fileName}`);
      onStageUpdate?.('Extracting text...');

      const extractionResult = await DocumentProcessorService.processDocument(fileObj.file!);
      console.log(`📄 Text extraction complete. Word count: ${extractionResult.wordCount}`);

      result.extractedText = extractionResult.extractedText;
      result.wordCount = extractionResult.wordCount;

      onStageUpdate?.('Text extraction completed', {
        extractedText: result.extractedText,
        wordCount: result.wordCount,
      });

      // STEP 2: FHIR conversion
      if (result.extractedText && result.extractedText.trim().length > 0) {
        console.log(`🩺 Step 2: Attempting FHIR conversion for: ${fileObj.fileName}`);
        onStageUpdate?.('Converting to FHIR...');

        try {
          const fhirResult = await convertToFHIR(result.extractedText);

          if (fhirResult && fhirResult.resourceType === 'Bundle') {
            result.fhirData = fhirResult;
            console.log(`✅ FHIR conversion successful for: ${fileObj.fileName}`);
            onStageUpdate?.('FHIR conversion completed', { fhirData: result.fhirData });
          }
        } catch (fhirError: any) {
          console.warn(`⚠️ FHIR conversion failed for ${fileObj.fileName}:`, fhirError.message);
        }
      }

      // STEP 3: AI Processing
      if (result.fhirData) {
        console.log(`🤖 Step 3: Starting AI processing for: ${fileObj.fileName}`);
        onStageUpdate?.('AI analyzing content...', { aiProcessingStatus: 'processing' });

        try {
          const BelroseFieldInputs = {
            fhirData: result.fhirData,
            fileName: fileObj.fileName,
            extractedText: result.extractedText || undefined,
            contextText: fileObj.contextText || undefined,
          };

          const aiResult = await createBelroseFields(BelroseFieldInputs);

          result.belroseFields = {
            visitType: aiResult.visitType,
            title: aiResult.title,
            summary: aiResult.summary,
            completedDate: aiResult.completedDate,
            provider: aiResult.provider,
            patient: aiResult.patient,
            institution: aiResult.institution,
            detailedNarrative: aiResult.detailedNarrative,
          };

          result.aiProcessingStatus = 'completed';

          console.log(`✅ AI processing completed for: ${fileObj.fileName}`, aiResult);
        } catch (error: any) {
          console.error(`❌ AI processing failed for ${fileObj.fileName}:`, error);

          result.aiProcessingStatus = 'failed';

          toast.error(`AI analysis failed for ${fileObj.fileName}`, {
            description: error.message,
            duration: 5000,
          });
        }
      } else {
        result.aiProcessingStatus = 'not_needed';
        onStageUpdate?.('Completing...', { aiProcessingStatus: 'not_needed' });
      }

      // STEP 4: Generate record hash (plaintext, before encryption)
      console.log(`🔗 Step 4: Generating record hash for: ${fileObj.fileName}`);
      onStageUpdate?.('Generating record hash...');

      try {
        result.recordHash = await RecordHashService.generateRecordHash({
          fileName: fileObj.fileName,
          extractedText: result.extractedText,
          originalText: fileObj.originalText,
          originalFileHash: fileObj.originalFileHash,
          contextText: fileObj.contextText,
          fhirData: result.fhirData,
          belroseFields: result.belroseFields,
          customData: fileObj.customData,
        });

        console.log(`✅ Record hash generated for: ${fileObj.fileName}`, {
          hash: result.recordHash.substring(0, 12) + '...',
        });

        toast.success(`🔗 Record hash generated for ${fileObj.fileName}`, {
          description: `Hash: ${result.recordHash.substring(0, 12)}...`,
          duration: 3000,
        });
      } catch (error: any) {
        console.error(`❌ Record hash generation failed for ${fileObj.fileName}:`, error);

        toast.warning(`Record hash generation failed for ${fileObj.fileName}`, {
          description: 'Record will be saved without hash verification',
          duration: 4000,
        });

        console.warn(`⚠️ Continuing without record hash for ${fileObj.fileName}`);
      }

      // STEP 5: Encryption

      logEncryption('Starting complete record encryption', {
        fileName: fileObj.fileName,
      });
      console.log(`🔒 Step 5: Encrypting file: ${fileObj.fileName}`);
      onStageUpdate?.('Encrypting record data...');

      const userKey = await EncryptionKeyManager.getSessionKey();
      if (!userKey) {
        throw new Error('No encryption session active');
      }

      try {
        result.encryptedData = await measurePerformance(
          `Complete Record Encryption: ${fileObj.fileName}`,
          async () => {
            return await EncryptionService.encryptCompleteRecord(
              fileObj.fileName,
              fileObj.file,
              result.extractedText,
              fileObj.originalText,
              fileObj.contextText,
              result.fhirData,
              result.belroseFields,
              null,
              userKey
            );
          }
        );

        logEncryption('Encryption complete', {
          fileName: fileObj.fileName,
          components: Object.keys(result.encryptedData).filter(k => k !== 'encryptedKey'),
        });

        onStageUpdate?.('Record encrypted', { encryptedData: result.encryptedData });

        toast.success(`🔒 Record encrypted for ${fileObj.fileName}`, {
          description: 'All sensitive data is now encrypted',
          duration: 3000,
        });
      } catch (error: any) {
        console.error(`❌ Encryption failed for ${fileObj.fileName}:`, error);

        toast.error(`Encryption failed for ${fileObj.fileName}`, {
          description: error.message,
          duration: 5000,
        });

        throw new Error(`Encryption failed: ${error.message}`);
      }
      return result;
    } catch (error: any) {
      console.error(`💥 Processing failed for ${fileObj.fileName}:`, error);
      onError?.(error);
      throw error;
    }
  }

  /**
   * Process a virtual file (from text/FHIR input):
   * 1. AI processing (if FHIR data and belroseFields not provided)
   * 2. Generate record hash
   * 3. Encrypt (if enabled)
   */
  static async processVirtualFile(
    virtualData: VirtualFileInput,
    fileName: string,
    callbacks?: ProcessingCallbacks
  ): Promise<ProcessedRecord> {
    const { onStageUpdate } = callbacks || {};
    const result: ProcessedRecord = {};

    // STEP 1: AI Processing (if FHIR data exists and belroseFields not provided)
    if (virtualData.fhirData && !virtualData.belroseFields) {
      console.log(`🤖 Starting AI processing for virtual file: ${fileName}`);
      onStageUpdate?.('AI analyzing content...', { aiProcessingStatus: 'processing' });

      try {
        const virtualBelroseFieldInputs = {
          fhirData: virtualData.fhirData,
          fileName: fileName,
          originalText: virtualData.originalText,
          contextText: virtualData.contextText,
        };

        const aiResult = await createBelroseFields(virtualBelroseFieldInputs);

        result.belroseFields = {
          visitType: aiResult.visitType,
          title: aiResult.title,
          summary: aiResult.summary,
          completedDate: aiResult.completedDate,
          provider: aiResult.provider,
          patient: aiResult.patient,
          institution: aiResult.institution,
          detailedNarrative: aiResult.detailedNarrative,
        };

        result.aiProcessingStatus = 'completed';
      } catch (error: any) {
        console.error(`❌ AI processing failed for virtual file ${fileName}:`, error);
        result.aiProcessingStatus = 'failed';

        toast.error(`AI analysis failed for ${fileName}`, {
          description: error.message,
          duration: 5000,
        });
      }
    } else if (virtualData.belroseFields) {
      // Use provided belroseFields
      result.belroseFields = virtualData.belroseFields;
      result.aiProcessingStatus = virtualData.aiProcessingStatus || 'completed';
    } else {
      result.aiProcessingStatus = 'not_needed';
    }

    // Marks AI analysis as complete for UI/UX
    onStageUpdate?.('AI analyzing content...', {
      aiProcessingStatus: 'completed',
      belroseFields: result.belroseFields,
    });

    // STEP 2: Generate record hash
    console.log('🔗 Generating record hash for virtual file:', fileName);
    onStageUpdate?.('Generating record hash...');

    const virtualFileForHash: HashableFileContent = {
      fileName: fileName,
      originalText: virtualData.originalText,
      contextText: virtualData.contextText,
      fhirData: virtualData.fhirData,
      belroseFields: result.belroseFields,
      customData: virtualData.customData,
      extractedText: null,
      originalFileHash: null,
    };

    try {
      result.recordHash = await RecordHashService.generateRecordHash(virtualFileForHash);

      console.log(`✅ Record hash generated for virtual file: ${fileName}`, {
        hash: result.recordHash.substring(0, 12) + '...',
      });

      toast.success(`🔗 Virtual file hash generated: ${fileName}`, {
        description: `Hash: ${result.recordHash.substring(0, 12)}...`,
        duration: 3000,
      });
    } catch (error: any) {
      console.error(`❌ Hash generation failed for virtual file ${fileName}:`, error);

      toast.warning(`Hash generation failed for ${fileName}`, {
        description: 'File will be saved without hash verification',
        duration: 3000,
      });
    }

    // STEP 3: Encryption
    if (virtualData.fhirData || virtualData.originalText) {
      logEncryption('Encrypting virtual file', { fileName });
      onStageUpdate?.('Encrypting record data...');

      const userKey = await EncryptionKeyManager.getSessionKey();
      if (!userKey) {
        throw new Error('No encryption session active');
      }

      try {
        result.encryptedData = await EncryptionService.encryptCompleteRecord(
          fileName,
          undefined,
          null,
          virtualData.originalText,
          virtualData.contextText,
          virtualData.fhirData,
          result.belroseFields,
          null,
          userKey
        );

        toast.success(`🔒 Virtual file encrypted: ${fileName}`);
      } catch (error: any) {
        console.error('Encryption failed for virtual file:', error);
        toast.error(`Encryption failed: ${error.message}`);
        throw error;
      }
    }

    return {
      fhirData: virtualData.fhirData,
      belroseFields: result.belroseFields,
      aiProcessingStatus: result.aiProcessingStatus,
      recordHash: result.recordHash,
      encryptedData: result.encryptedData,
    };
  }
}
