import { aiImageService } from '@/features/AddRecord/services/aiImageService';
import { extractImageTextOCR } from './textExtractionService';
import { TextExtractionResult } from './shared.types';
import {
  ProcessingRecommendation,
  CompressionResult,
  IVisionExtractionService,
  VisionAnalysisOptions,
  CompressionOptions
} from './visionExtractService.types';

/**
 * Service for vision-based text extraction and image analysis
 * Simplified for MVP - focuses on text extraction only
 */
class VisionExtractionService implements IVisionExtractionService {

  /**
   * Extract text from images using AI Vision with OCR fallback
   */
  async extractImageText(file: File, options: VisionAnalysisOptions = {}): Promise<TextExtractionResult> {
    console.log('Starting AI Vision image text extraction for:', file.name);
    
    // Validate input
    if (!this.canProcess(file)) {
      throw new Error(`File type ${file.type} is not supported for vision processing`);
    }

    try {
      // Try AI Vision first for better accuracy
      const visionResult = await aiImageService.extractTextFromImage(file);
      
      // Handle the new TextExtractionResult format
      return {
        text: visionResult.extractedText || '',
        method: 'ai_vision',
        confidence: 0.9, // AI Vision typically has high confidence
        processingTime: 'fast',
        source: 'ai_vision',
        success: visionResult.success,
        wordCount: visionResult.wordCount
      };
    } catch (visionError: any) {
      console.warn('AI Vision failed, falling back to Tesseract OCR:', visionError);
      
      try {
        // Fallback to traditional OCR
        const ocrText = await extractImageTextOCR(file);
        
        return {
          text: ocrText,
          method: 'tesseract_ocr',
          confidence: 0.6, // OCR generally has lower confidence
          processingTime: 'slow',
          fallbackReason: visionError.message,
          source: 'ocr_fallback',
          success: true,
          wordCount: ocrText.split(/\s+/).length
        };
      } catch (ocrError: any) {
        console.error('Both AI Vision and OCR failed:', ocrError);
        throw new Error(`Image text extraction failed: ${ocrError.message}`);
      }
    }
  }

  /**
   * Check if a file can be processed by vision services
   */
  canProcess(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * Get recommended processing approach for an image file
   */
  getProcessingRecommendation(file: File): ProcessingRecommendation {
    const fileSize = file.size;
    const fileType = file.type;
    
    // Validate that it's an image
    if (!this.canProcess(file)) {
      return {
        approach: 'unsupported',
        recommendation: `File type ${fileType} is not supported for vision processing`,
        estimatedTime: 'N/A',
        shouldCompress: false,
        canProcess: false
      };
    }
    
    // Large images may benefit from compression before processing
    if (fileSize > 5 * 1024 * 1024) {
      return {
        approach: 'ai_vision',
        recommendation: 'Large image - AI Vision recommended for efficiency, compression suggested',
        estimatedTime: '5-15 seconds',
        shouldCompress: true,
        canProcess: true,
        priority: 'high'
      };
    }
    
    // High-quality formats work well with AI Vision
    if (['image/png', 'image/jpeg', 'image/jpg'].includes(fileType)) {
      return {
        approach: 'ai_vision',
        recommendation: 'High-quality format - AI Vision optimal',
        estimatedTime: '2-8 seconds',
        shouldCompress: false,
        canProcess: true,
        priority: 'medium'
      };
    }
    
    // Other formats may work better with hybrid approach
    return {
      approach: 'hybrid',
      recommendation: 'Try AI Vision first, OCR fallback available',
      estimatedTime: '5-20 seconds',
      shouldCompress: false,
      canProcess: true,
      priority: 'low'
    };
  }

  /**
   * Compress image if needed before processing
   */
  async compressImageIfNeeded(
    file: File, 
    maxSize: number = 2 * 1024 * 1024,
    options: CompressionOptions = {}
  ): Promise<File> {
    
    if (file.size <= maxSize) {
      console.log(`Image ${file.name} is already under size limit (${file.size} bytes)`);
      return file; // No compression needed
    }

    console.log(`Compressing image ${file.name} (${file.size} bytes > ${maxSize} bytes)`);

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas 2D context'));
        return;
      }

      const img = new Image();

      img.onload = () => {
        try {
          // Calculate new dimensions (maintain aspect ratio)
          const compressionRatio = Math.sqrt(maxSize / file.size);
          
          // Apply max width/height constraints if specified
          let newWidth = img.width * compressionRatio;
          let newHeight = img.height * compressionRatio;
          
          if (options.maxWidth && newWidth > options.maxWidth) {
            const widthRatio = options.maxWidth / newWidth;
            newWidth = options.maxWidth;
            newHeight = newHeight * widthRatio;
          }
          
          if (options.maxHeight && newHeight > options.maxHeight) {
            const heightRatio = options.maxHeight / newHeight;
            newHeight = options.maxHeight;
            newWidth = newWidth * heightRatio;
          }

          canvas.width = newWidth;
          canvas.height = newHeight;

          // Draw compressed image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Convert back to file
          const outputFormat = options.format || file.type;
          const quality = options.quality || 0.8;
          
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: outputFormat,
                lastModified: file.lastModified
              });
              
              console.log(`Image compressed: ${file.size} → ${compressedFile.size} bytes (${Math.round((1 - compressedFile.size / file.size) * 100)}% reduction)`);
              resolve(compressedFile);
            } else {
              reject(new Error('Image compression failed - blob creation returned null'));
            }
          }, outputFormat, quality);
        } catch (error) {
          reject(new Error(`Image compression failed: ${error}`));
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for compression'));
      };
      
      // Create object URL for the image
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Batch process multiple images for text extraction
   */
  async processImageBatch(
    files: File[], 
    options: VisionAnalysisOptions = {}
  ): Promise<TextExtractionResult[]> {
    console.log(`Starting batch processing of ${files.length} images`);
    
    const results: TextExtractionResult[] = [];
    
    for (const file of files) {
      try {
        const result = await this.extractImageText(file, options);
        results.push(result);
      } catch (error: any) {
        console.error(`Batch processing failed for ${file.name}:`, error);
        
        // Add failed result
        results.push({
          text: '',
          method: 'failed',
          confidence: 0,
          processingTime: 'failed',
          source: 'error',
          success: false,
          error: error.message,
          wordCount: 0
        });
      }
    }
    
    return results;
  }

  /**
   * Validate image file before processing
   */
  validateImageFile(file: File): { valid: boolean; error?: string; warnings?: string[] } {
    const warnings: string[] = [];
    
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      return {
        valid: false,
        error: `File type ${file.type} is not an image`
      };
    }

    // Check file size limits
    const maxSize = 50 * 1024 * 1024; // 50MB hard limit
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `Image file too large (${Math.round(file.size / 1024 / 1024)}MB > 50MB)`
      };
    }

    // Check for optimal size
    if (file.size > 10 * 1024 * 1024) {
      warnings.push('Large image file - processing may be slow');
    }

    // Check for tiny images
    if (file.size < 1024) {
      warnings.push('Very small image file - text extraction may be poor');
    }

    // Check supported formats
    const optimalFormats = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!optimalFormats.includes(file.type)) {
      warnings.push(`Image format ${file.type} may not be optimal for text extraction`);
    }

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Get compression statistics for a file
   */
  async getCompressionPreview(
    file: File, 
    targetSize: number
  ): Promise<CompressionResult> {
    const compressionRatio = Math.sqrt(targetSize / file.size);
    
    // Create a temporary canvas to estimate dimensions
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        const newWidth = Math.round(img.width * compressionRatio);
        const newHeight = Math.round(img.height * compressionRatio);
        const estimatedSize = Math.round(file.size * compressionRatio * compressionRatio);
        
        resolve({
          compressedFile: file, // Placeholder - actual compression not performed
          originalSize: file.size,
          compressedSize: estimatedSize,
          compressionRatio: compressionRatio,
          newDimensions: { width: newWidth, height: newHeight },
          originalDimensions: { width: img.width, height: img.height },
          estimatedQualityLoss: Math.round((1 - compressionRatio) * 100)
        });
      };
      
      img.onerror = () => reject(new Error('Failed to load image for compression preview'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Extract text with automatic image optimization
   */
  async extractTextOptimized(file: File, options: VisionAnalysisOptions = {}): Promise<TextExtractionResult> {
    // Get processing recommendation
    const recommendation = this.getProcessingRecommendation(file);
    
    // Compress if recommended
    let processFile = file;
    if (recommendation.shouldCompress) {
      processFile = await this.compressImageIfNeeded(file);
    }
    
    // Extract text with optimized file
    return await this.extractImageText(processFile, options);
  }
}

// ==================== EXPORT PATTERNS ====================

// Create a singleton instance for backward compatibility
const visionExtractionService = new VisionExtractionService();

// Export the instance as default (matches original pattern)
export default visionExtractionService;

// Export the class for advanced usage
export { VisionExtractionService };

// Export individual methods for backward compatibility
export const {
  extractImageText,
  canProcess,
  getProcessingRecommendation,
  compressImageIfNeeded
} = visionExtractionService;