// src/features/AddRecord/services/visionExtractionService.types.ts

// ==================== VISION ANALYSIS TYPES ====================

export interface VisionAnalysisResult {
  extractedText: string;
  isMedical: boolean;
  confidence: number;
  documentType?: string;
  reasoning?: string;
  method?: string;
  processingTime?: ProcessingTime;  // ← More specific type
  fallbackReason?: string;
  
  // Enhanced AI Vision fields
  medicalSpecialty?: string;
  structuredData?: any;
  imageQuality?: string;
  readabilityScore?: number;
}

export interface TextExtractionResult {
  text: string;
  method: string;
  confidence?: number;
  processingTime?: ProcessingTime;  // ← More specific type
  fallbackReason?: string;
  source?: ExtractionSource;        // ← More specific type
}

export interface ProcessingRecommendation {
  approach: string;
  recommendation: string;
  estimatedTime: string;
  shouldCompress: boolean;  // ← This was missing!
  canProcess?: boolean;
  priority?: 'low' | 'medium' | 'high';
}

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  newDimensions?: { width: number; height: number };
  originalDimensions?: { width: number; height: number };
  estimatedQualityLoss?: number;
}

// ==================== SERVICE INTERFACE ====================

export interface IVisionExtractionService {
  // Core extraction methods
  extractImageText(file: File, options?: VisionAnalysisOptions): Promise<TextExtractionResult>;
  analyzeImageFull(file: File, options?: VisionAnalysisOptions): Promise<VisionAnalysisResult>;
  
  // Utility methods
  canProcess(file: File): boolean;
  getProcessingRecommendation(file: File): ProcessingRecommendation;
  compressImageIfNeeded(file: File, maxSize?: number, options?: CompressionOptions): Promise<File>;
  
  // Advanced methods
  processImageBatch(files: File[], options?: VisionAnalysisOptions): Promise<VisionAnalysisResult[]>;
  validateImageFile(file: File): { valid: boolean; error?: string; warnings?: string[] };
  getCompressionPreview(file: File, targetSize: number): Promise<CompressionResult>;
  extractTextOptimized(file: File, options?: VisionAnalysisOptions): Promise<TextExtractionResult>;
}

// ==================== OPTIONS INTERFACES ====================

export interface VisionAnalysisOptions {
  enableTextDetection?: boolean;
  enableMedicalAnalysis?: boolean;
  confidenceThreshold?: number;
  maxImageSize?: number;
  language?: string;
  enhanceText?: boolean;
}

export interface CompressionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'png' | 'webp';
  maintainAspectRatio?: boolean;
}

// ==================== AI IMAGE SERVICE TYPES ====================

export interface AIImageServiceResult {
  extractedText?: string;
  isMedical?: boolean;
  confidence?: number;
  documentType?: string;
  reasoning?: string;
  suggestion?: string;
  medicalSpecialty?: string;
  structuredData?: any;
  imageQuality?: string;
  readabilityScore?: number;
}

// ==================== ERROR TYPES ====================

export class VisionExtractionError extends Error {
  constructor(
    message: string,
    public code: VisionErrorCode,
    public fileName?: string
  ) {
    super(message);
    this.name = 'VisionExtractionError';
  }
}

export type VisionErrorCode = 
  | 'UNSUPPORTED_FORMAT'
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_CORRUPTED'
  | 'AI_VISION_FAILED'
  | 'OCR_FAILED'
  | 'COMPRESSION_FAILED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

// ==================== UTILITY TYPES ====================

export type ImageFormat = 'jpeg' | 'jpg' | 'png' | 'gif' | 'bmp' | 'webp';
export type ProcessingMethod = 'ai_vision' | 'ai_vision_full' | 'tesseract_ocr' | 'hybrid' | 'fallback_text_only' | 'failed';
export type ProcessingPriority = 'low' | 'medium' | 'high';
export type ProcessingTime = 'fast' | 'medium' | 'slow' | 'failed';
export type ExtractionSource = 'ai_vision' | 'ocr_fallback' | 'hybrid' | 'failed';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ProcessingStats {
  totalFiles: number;
  successful: number;
  failed: number;
  aiVisionUsed: number;
  ocrFallbackUsed: number;
  averageConfidence: number;
  totalProcessingTime: number;
}