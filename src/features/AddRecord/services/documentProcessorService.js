import TextExtractionService from './textExtractionService';
import VisionExtractionService from './visionExtractionService';
import { aiMedicalDetectionService } from '@/features/AddRecord/services/aiMedicalDetectionService';

/**
 * Process a document file through the complete pipeline
 * @param {File} file - File to process
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Complete processing result
 */
async function processDocument(file, options = {}) {
  const {
    enableMedicalDetection = false, //Set as false for testing. Save on API
    enableVisionAI = true,
    compressionThreshold = 2 * 1024 * 1024 // 2MB
  } = options;

  console.log(`Processing document: ${file.name} (${file.type})`);

  try {
    let result = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      processingSteps: [],
      extractedText: null,
      wordCount: 0,
      medicalDetection: null,
      processingMethod: null,
      success: false,
      error: null,
      processingTime: Date.now()
    };

    // Step 1: Text Extraction
    result.processingSteps.push('text_extraction_started');
    
    if (file.type.startsWith('image/')) {
      result = await _processImageFile(file, result, enableVisionAI, compressionThreshold);
    } else {
      result = await _processDocumentFile(file, result);
    }

    // Step 2: Medical Detection (if enabled and text was extracted)
    if (enableMedicalDetection && result.extractedText) {
      result.processingSteps.push('medical_detection_started');
      result = await _performMedicalDetection(file, result);
    }

    // Calculate final metrics
    result.wordCount = result.extractedText ? result.extractedText.split(/\s+/).length : 0;
    result.processingTime = Date.now() - result.processingTime;
    result.success = true;
    result.processingSteps.push('processing_completed');

    console.log(`Document processing completed in ${result.processingTime}ms`);
    return result;

  } catch (error) {
    console.error(`Document processing failed for ${file.name}:`, error);
    return {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      processingSteps: ['processing_failed'],
      success: false,
      error: error.message,
      processingTime: Date.now() - (result?.processingTime || Date.now())
    };
  }
}

/**
 * Process image files using Vision AI or OCR
 * @private
 */
async function _processImageFile(file, result, enableVisionAI, compressionThreshold) {
  if (enableVisionAI) {
    try {
      // Try full AI Vision analysis first
      result.processingSteps.push('ai_vision_analysis');
      const visionResult = await VisionExtractionService.analyzeImageFull(file);
      
      result.extractedText = visionResult.extractedText;
      result.medicalDetection = {
        isMedical: visionResult.isMedical,
        confidence: visionResult.confidence,
        documentType: visionResult.documentType,
        reasoning: visionResult.reasoning,
        source: 'ai_vision'
      };
      result.processingMethod = 'ai_vision_full';
      result.processingSteps.push('ai_vision_completed');
      
      return result;
    } catch (visionError) {
      console.warn('AI Vision analysis failed, falling back to text extraction:', visionError);
      result.processingSteps.push('ai_vision_failed');
    }
  }

  // Fallback to text extraction only
  result.processingSteps.push('image_text_extraction');
  
  // Compress if needed
  let fileToProcess = file;
  if (file.size > compressionThreshold) {
    result.processingSteps.push('image_compression');
    fileToProcess = await VisionExtractionService.compressImageIfNeeded(file, compressionThreshold);
  }

  const textResult = await VisionExtractionService.extractImageText(fileToProcess);
  result.extractedText = textResult.text;
  result.processingMethod = textResult.method;
  result.processingSteps.push('image_text_completed');

  return result;
}

/**
 * Process non-image document files
 * @private
 */
async function _processDocumentFile(file, result) {
  result.processingSteps.push('document_text_extraction');
  result.extractedText = await TextExtractionService.extractText(file);
  result.processingMethod = _getExtractionMethodName(file.type);
  result.processingSteps.push('document_text_completed');
  
  return result;
}

/**
 * Perform medical content detection
 * @private
 */
async function _performMedicalDetection(file, result) {
  try {
    const detection = await aiMedicalDetectionService.detectMedicalRecord(
      result.extractedText,
      file.name,
      file.type
    );

    result.medicalDetection = {
      ...detection,
      source: 'text_analysis'
    };
    result.processingSteps.push('medical_detection_completed');
    
    return result;
  } catch (error) {
    console.error('Medical detection failed:', error);
    result.medicalDetection = {
      isMedical: false,
      confidence: 0,
      documentType: 'unknown',
      reasoning: `Detection failed: ${error.message}`,
      source: 'error'
    };
    result.processingSteps.push('medical_detection_failed');
    
    return result;
  }
}

/**
 * Get human-readable extraction method name
 * @private
 */
function _getExtractionMethodName(fileType) {
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

/**
 * Validate if a file can be processed
 * @param {File} file - File to validate
 * @returns {Object} Validation result
 */
function validateFile(file) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const supportedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp'
  ];

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds 10MB limit (${Math.round(file.size / 1024 / 1024)}MB)`
    };
  }

  const isSupported = supportedTypes.includes(file.type) || 
                     file.type.startsWith('text/') || 
                     file.type.startsWith('image/');

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
 * @param {File} file - File to analyze
 * @returns {Object} Processing recommendations
 */
function getProcessingRecommendations(file) {
  const validation = validateFile(file);
  if (!validation.valid) {
    return { 
      canProcess: false, 
      error: validation.error 
    };
  }

  if (file.type.startsWith('image/')) {
    const imageRec = VisionExtractionService.getProcessingRecommendation(file);
    return {
      canProcess: true,
      ...imageRec,
      enableVisionAI: true
    };
  }

  return {
    canProcess: true,
    approach: 'standard_extraction',
    recommendation: TextExtractionService.getEstimatedProcessingTime(file),
    estimatedTime: '1-5 seconds',
    enableVisionAI: false
  };
}

/**
 * Batch process multiple files
 * @param {File[]} files - Array of files to process
 * @param {Object} options - Processing options
 * @returns {Promise<Object[]>} Array of processing results
 */
async function processMultipleDocuments(files, options = {}) {
  const { maxConcurrent = 3 } = options;
  
  console.log(`Processing ${files.length} files with max ${maxConcurrent} concurrent`);

  const results = [];
  
  // Process files in batches to avoid overwhelming the system
  for (let i = 0; i < files.length; i += maxConcurrent) {
    const batch = files.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(file => processDocument(file, options));
    
    try {
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : {
          success: false,
          error: result.reason?.message || 'Unknown error',
          fileName: 'unknown'
        }
      ));
    } catch (error) {
      console.error('Batch processing error:', error);
      // Add error results for failed batch
      batch.forEach(file => {
        results.push({
          fileName: file.name,
          success: false,
          error: 'Batch processing failed'
        });
      });
    }
  }

  return results;
}

// Create a service object for cleaner usage
const documentProcessorService = {
  processDocument,
  validateFile,
  getProcessingRecommendations,
  processMultipleDocuments
};

// Export the service object as default and functions as named exports
export default documentProcessorService;

export {
  validateFile,
  getProcessingRecommendations,
  processMultipleDocuments
};