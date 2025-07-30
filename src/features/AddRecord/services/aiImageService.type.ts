export interface ImageData {
  base64: string;
  mediaType: string;
}

export interface AnalysisRequest {
  image: ImageData;
  fileName: string;
  fileType: string;
  analysisType: AnalysisType;
}

export type AnalysisType = 'detection' | 'extraction' | 'full';

export interface MedicalDetectionResult {
  isMedical: boolean;
  confidence: number;
  documentType: string;
  reasoning: string;
  suggestion: string;
}

export interface FullAnalysisResult extends MedicalDetectionResult {
  extractedText?: string;
  medicalSpecialty?: string;
  structuredData?: any;
  imageQuality?: string;
  readabilityScore?: number;
}

export interface ApiErrorResponse {
  error: string;
}

/**
 * Medical file extensions and MIME types
 */
export const MEDICAL_FILE_EXTENSIONS = [
  '.dcm', 
  '.dicom', 
  '.nii', 
  '.nii.gz', 
  '.mha', 
  '.mhd'
] as const;

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp'
] as const;

export type SupportedImageType = typeof SUPPORTED_IMAGE_TYPES[number];
export type MedicalFileExtension = typeof MEDICAL_FILE_EXTENSIONS[number];