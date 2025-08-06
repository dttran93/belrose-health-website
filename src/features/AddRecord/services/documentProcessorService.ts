import TextExtractionService from './textExtractionService';
import VisionExtractionService from './visionExtractionService';
import { 
  FileValidationResult, 
  ProcessingOptions, 
  DocumentProcessingResult,
  SupportedFileType,
  ProcessingStep,
  IDocumentProcessorService,
  isValidFileType
} from './documentProcessorService.types';

// Import service type definitions
import type { VisionAnalysisResult, TextExtractionResult } from './visionExtractService.types';

/**
 * Simplified service for processing documents through text extraction only
 * Handles both regular documents (PDF, Word) and images (JPG, PNG) with OCR
 */
class DocumentProcessorService implements IDocumentProcessorService {
  
  /**
   * Process a document file through the simplified pipeline
   */
  async processDocument(file: File, options: ProcessingOptions = {}): Promise<DocumentProcessingResult> {
    const {
      enableVisionAI = true,
      compressionThreshold = 2 * 1024 * 1024, // 2MB
      signal
    } = options;

    console.log(`Processing document: ${file.name} (${file.type})`);

    try {
      let result: DocumentProcessingResult = {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        processingSteps: [],
        extractedText: null,
        wordCount: 0,
        processingMethod: null,
        success: false,
        error: null,
        processingTime: Date.now()
      };

      // Check for cancellation
      if (signal?.aborted) {
        throw new Error('Processing cancelled');
      }

      // Text Extraction
      result.processingSteps.push('text_extraction_started');
      
      if (file.type.startsWith('image/')) {
        result = await this.processImageFile(file, result, enableVisionAI, compressionThreshold, signal);
      } else {
        result = await this.processDocumentFile(file, result, signal);
      }

      // Check for cancellation after text extraction
      if (signal?.aborted) {
        throw new Error('Processing cancelled after text extraction');
      }

      // Calculate final metrics
      result.wordCount = result.extractedText ? 
        result.extractedText.split(/\s+/).length : 0;
      result.processingTime = Date.now() - result.processingTime;
      result.success = true;
      result.processingSteps.push('processing_completed');

      console.log(`Document processing completed in ${result.processingTime}ms`);
      return result;

    } catch (error: any) {
      console.error(`Document processing failed for ${file.name}:`, error);
      
      return {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        processingSteps: ['processing_failed'],
        extractedText: null,
        wordCount: 0,
        processingMethod: null,
        success: false,
        error: error.message,
        processingTime: Date.now() - (Date.now()) // Fallback timing
      };
    }
  }

  /**
   * Validate if a file can be processed
   */
  validateFile(file: File): FileValidationResult {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const supportedTypes: SupportedFileType[] = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'image/jpeg',
      'image/png'
    ];

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds 10MB limit (${Math.round(file.size / 1024 / 1024)}MB)`
      };
    }

    const isSupported = supportedTypes.includes(file.type as SupportedFileType) || 
                       file.type.startsWith('text/') || 
                       file.type.startsWith('image/') ||
                       isValidFileType(file.type);

    if (!isSupported) {
      return {
        valid: false,
        error: `File type '${file.type}' is not supported`
      };
    }

    return { valid: true };
  }

  /**
   * Get processing recommendations for a file
   */
  getProcessingRecommendations(file: File): ProcessingRecommendation {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      return { 
        canProcess: false, 
        error: validation.error 
      };
    }

    if (file.type.startsWith('image/')) {
      const imageRec = VisionExtractionService.getProcessingRecommendation?.(file) || {
        estimatedTime: '5-15 seconds',
        recommendation: 'Use AI Vision for best results'
      };
      
      return {
        canProcess: true,
        ...imageRec,
        enableVisionAI: true,
        approach: 'ai_vision_extraction'
      };
    }

    return {
      canProcess: true,
      approach: 'standard_extraction',
      recommendation: 'Standard text extraction',
      estimatedTime: '1-5 seconds',
      enableVisionAI: false
    };
  }

  /**
   * Batch process multiple files
   */
  async processMultipleDocuments(files: File[], options: BatchProcessingOptions = {}): Promise<DocumentProcessingResult[]> {
    const { maxConcurrent = 3, ...processingOptions } = options;
    
    console.log(`Processing ${files.length} files with max ${maxConcurrent} concurrent`);

    const results: DocumentProcessingResult[] = [];
    
    // Process files in batches to avoid overwhelming the system
    for (let i = 0; i < files.length; i += maxConcurrent) {
      const batch = files.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(file => this.processDocument(file, processingOptions));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults.map((result, index) => 
          result.status === 'fulfilled' ? result.value : {
            fileName: batch[index]?.name || 'unknown',
            fileType: batch[index]?.type || 'unknown',
            fileSize: batch[index]?.size || 0,
            processingSteps: ['processing_failed'],
            extractedText: null,
            wordCount: 0,
            processingMethod: null,
            success: false,
            error: result.reason?.message || 'Unknown error',
            processingTime: 0
          }
        ));
      } catch (error: any) {
        console.error('Batch processing error:', error);
        // Add error results for failed batch
        batch.forEach(file => {
          results.push({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            processingSteps: ['processing_failed'],
            extractedText: null,
            wordCount: 0,
            processingMethod: null,
            success: false,
            error: 'Batch processing failed',
            processingTime: 0
          });
        });
      }
    }

    return results;
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Process image files using Vision AI or OCR
   */
  private async processImageFile(
    file: File, 
    result: DocumentProcessingResult, 
    enableVisionAI: boolean, 
    compressionThreshold: number,
    signal?: AbortSignal
  ): Promise<DocumentProcessingResult> {
    
    if (enableVisionAI) {
      try {
        // Check for cancellation
        if (signal?.aborted) {
          throw new Error('Processing cancelled');
        }

        // Try AI Vision text extraction
        result.processingSteps.push('ai_vision_analysis');
        const visionResult: VisionAnalysisResult = await VisionExtractionService.analyzeImageFull(file) as VisionAnalysisResult;
        
        result.extractedText = visionResult.extractedText;
        result.processingMethod = 'ai_vision_text_only';
        result.processingSteps.push('ai_vision_completed');
        
        return result;
      } catch (visionError: any) {
        console.warn('AI Vision analysis failed, falling back to text extraction:', visionError);
        result.processingSteps.push('ai_vision_failed');
      }
    }

    // Fallback to basic text extraction
    result.processingSteps.push('image_text_extraction');
    
    // Compress if needed
    let fileToProcess = file;
    if (file.size > compressionThreshold) {
      result.processingSteps.push('image_compression');
      fileToProcess = await VisionExtractionService.compressImageIfNeeded(file, compressionThreshold);
    }

    const textResult: TextExtractionResult = await VisionExtractionService.extractImageText(fileToProcess) as TextExtractionResult;
    result.extractedText = textResult.text;
    result.processingMethod = textResult.method;
    result.processingSteps.push('image_text_completed');

    return result;
  }

  /**
   * Process non-image document files
   */
  private async processDocumentFile(
    file: File, 
    result: DocumentProcessingResult,
    signal?: AbortSignal
  ): Promise<DocumentProcessingResult> {
    
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Processing cancelled');
    }

    result.processingSteps.push('document_text_extraction');
    result.extractedText = await TextExtractionService.extractText(file);
    result.processingMethod = this.getExtractionMethodName(file.type);
    result.processingSteps.push('document_text_completed');
    
    return result;
  }

  /**
   * Get human-readable extraction method name
   */
  private getExtractionMethodName(fileType: string): string {
    switch (true) {
      case fileType === 'application/pdf':
        return 'pdf_extraction';
      case fileType.includes('word'):
        return 'word_extraction';
      case fileType.startsWith('text/'):
        return 'text_extraction';
      default:
        return 'unknown_extraction';
    }
  }
}

// ==================== ADDITIONAL TYPES ====================

interface ProcessingRecommendation {
  canProcess: boolean;
  error?: string;
  approach?: string;
  recommendation?: string;
  estimatedTime?: string;
  enableVisionAI?: boolean;
}

interface BatchProcessingOptions extends ProcessingOptions {
  maxConcurrent?: number;
}

// ==================== EXPORT PATTERNS ====================

// Create a singleton instance for backward compatibility
const documentProcessorService = new DocumentProcessorService();

// Export the instance as default (matches original pattern)
export default documentProcessorService;

// Export the class for advanced usage
export { DocumentProcessorService };

// Export individual methods for backward compatibility
export const {
  validateFile,
  getProcessingRecommendations,
  processMultipleDocuments,
  processDocument
} = documentProcessorService;