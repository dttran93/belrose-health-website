import { aiImageService } from '@/components/AddRecord/services/aiImageService';
import { extractImageTextOCR } from './textExtractionService';

/**
 * Extract text from images using AI Vision with OCR fallback
 * @param {File} file - Image file to extract text from
 * @returns {Promise<Object>} Extraction result with text and metadata
 */
async function extractImageText(file) {
  console.log('Starting AI Vision image text extraction for:', file.name);
  
  try {
    // Try AI Vision first for better accuracy
    const visionResult = await aiImageService.extractTextFromImage(file);
    
    return {
      text: visionResult,
      method: 'ai_vision',
      confidence: 'high', // AI Vision typically has high confidence
      processingTime: 'fast'
    };
  } catch (visionError) {
    console.warn('AI Vision failed, falling back to Tesseract OCR:', visionError);
    
    try {
      // Fallback to traditional OCR
      const ocrText = await extractImageTextOCR(file);
      
      return {
        text: ocrText,
        method: 'tesseract_ocr',
        confidence: 'medium',
        processingTime: 'slow',
        fallbackReason: visionError.message
      };
    } catch (ocrError) {
      console.error('Both AI Vision and OCR failed:', ocrError);
      throw new Error(`Image text extraction failed: ${ocrError.message}`);
    }
  }
}

/**
 * Perform full AI analysis of an image (text + medical detection)
 * @param {File} file - Image file to analyze
 * @returns {Promise<Object>} Complete analysis result
 */
async function analyzeImageFull(file) {
  console.log('Starting full AI Vision analysis for:', file.name);
  
  try {
    // Use AI Vision for comprehensive analysis
    const analysisResult = await aiImageService.analyzeImageFull(file);
    
    return {
      ...analysisResult,
      method: 'ai_vision_full',
      confidence: analysisResult.confidence || 0.8,
      processingTime: 'medium'
    };
  } catch (error) {
    console.error('Full AI Vision analysis failed:', error);
    
    // Fallback to separate text extraction + detection
    try {
      const textResult = await extractImageText(file);
      
      return {
        extractedText: textResult.text,
        isMedical: false, // Cannot determine without full AI analysis
        confidence: 0.1, // Low confidence without proper analysis
        documentType: 'unknown',
        reasoning: 'AI Vision analysis failed, text extracted via fallback',
        method: 'fallback_text_only',
        processingTime: 'slow',
        fallbackReason: error.message
      };
    } catch (fallbackError) {
      throw new Error(`Complete image analysis failed: ${fallbackError.message}`);
    }
  }
}

/**
 * Check if a file can be processed by vision services
 * @param {File} file - File to check
 * @returns {boolean} Whether the file can be processed
 */
function canProcess(file) {
  return file.type.startsWith('image/');
}

/**
 * Get recommended processing approach for an image file
 * @param {File} file - Image file to analyze
 * @returns {Object} Processing recommendation
 */
function getProcessingRecommendation(file) {
  const fileSize = file.size;
  const fileType = file.type;
  
  // Large images may benefit from compression before processing
  if (fileSize > 5 * 1024 * 1024) {
    return {
      approach: 'ai_vision',
      recommendation: 'Large image - AI Vision recommended for efficiency',
      estimatedTime: '5-15 seconds',
      shouldCompress: true
    };
  }
  
  // High-quality formats work well with AI Vision
  if (['image/png', 'image/jpeg', 'image/jpg'].includes(fileType)) {
    return {
      approach: 'ai_vision',
      recommendation: 'High-quality format - AI Vision optimal',
      estimatedTime: '2-8 seconds',
      shouldCompress: false
    };
  }
  
  // Other formats may work better with OCR
  return {
    approach: 'hybrid',
    recommendation: 'Try AI Vision first, OCR fallback available',
    estimatedTime: '5-20 seconds',
    shouldCompress: false
  };
}

/**
 * Compress image if needed before processing
 * @param {File} file - Image file to potentially compress
 * @param {number} maxSize - Maximum file size in bytes
 * @returns {Promise<File>} Original or compressed file
 */
async function compressImageIfNeeded(file, maxSize = 2 * 1024 * 1024) {
  if (file.size <= maxSize) {
    return file; // No compression needed
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions (maintain aspect ratio)
      const compressionRatio = Math.sqrt(maxSize / file.size);
      canvas.width = img.width * compressionRatio;
      canvas.height = img.height * compressionRatio;

      // Draw compressed image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Convert back to file
      canvas.toBlob((blob) => {
        if (blob) {
          const compressedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: file.lastModified
          });
          console.log(`Image compressed: ${file.size} → ${compressedFile.size} bytes`);
          resolve(compressedFile);
        } else {
          reject(new Error('Image compression failed'));
        }
      }, file.type, 0.8); // 80% quality
    };

    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = URL.createObjectURL(file);
  });
}

// Create a service object for cleaner usage
const VisionExtractionService = {
  extractImageText,
  analyzeImageFull,
  canProcess,
  getProcessingRecommendation,
  compressImageIfNeeded
};

// Export main service object as default, functions as named exports
export default VisionExtractionService;

export {
  analyzeImageFull,
  canProcess,
  getProcessingRecommendation,
  compressImageIfNeeded
};