export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export interface ImageData {
  base64: string;
  mediaType: SupportedImageType;
}

/**
 * Request payload for image analysis API
 * POST /analyzeImageWithAI
 */
export interface ImageAnalysisRequest {
  image: ImageData;
  fileName?: string;
  fileType?: string;
}

/**
 * Response payload from image analysis API
 * POST /analyzeImageWithAI
 */
export interface ImageAnalysisResponse {
  extractedText?: string;
  keyFindings?: string[];
  error?: string;
}
