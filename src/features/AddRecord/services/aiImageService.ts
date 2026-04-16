export interface ApiErrorResponse {
  error: string;
}

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

import { ImageAnalysisRequest, SUPPORTED_IMAGE_TYPES } from '@belrose/shared';
import type { TextExtractionResult } from './shared.types';
import { fileToBase64 } from '@/utils/dataFormattingUtils';

export class AiImageService {
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = 'https://us-central1-belrose-757fe.cloudfunctions.net/analyzeImageWithAI';
  }

  //Get media type for API
  getMediaType(fileType: string): SupportedImageType {
    const mimeTypeMap: Record<string, SupportedImageType> = {
      'image/jpeg': 'image/jpeg',
      'image/jpg': 'image/jpeg',
      'image/png': 'image/png',
      'image/gif': 'image/gif',
      'image/webp': 'image/webp',
    };
    return mimeTypeMap[fileType] || 'image/jpeg';
  }

  //Extract text from image using AI Vision
  async extractTextFromImage(file: File): Promise<TextExtractionResult> {
    console.log('🎯 AI Service: Starting extraction for:', file.name);

    const validation = this.canProcessFile(file);
    if (!validation.canProcess) {
      console.error('❌ Validation failed:', validation.reason);
      return {
        text: '',
        method: 'ai_vision',
        success: false,
        error: validation.reason,
        wordCount: 0,
      };
    }

    try {
      const dataUrl = await fileToBase64(file);
      const base64Image = dataUrl.split(',')[1]; // strip the prefix

      if (!base64Image) {
        throw new Error('Missing Image');
      }
      console.log('📸 Base64 length:', base64Image.length);

      const mediaType = this.getMediaType(file.type);
      console.log('🔧 Media type:', mediaType);

      const requestBody: ImageAnalysisRequest = {
        image: { base64: base64Image, mediaType: mediaType },
        fileName: file.name,
        fileType: file.type,
      };

      console.log('📤 Sending request to:', this.apiUrl);
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Response status:', response.status, 'OK:', response.ok);

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        console.error('❌ Error response:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Success response:', result);

      // Calculate word count more accurately
      const wordCount = result.extractedText
        ? result.extractedText
            .trim()
            .split(/\s+/)
            .filter((w: string) => w.length > 0).length
        : 0;

      return {
        text: result.extractedText ?? '',
        method: 'ai_vision',
        success: true,
        wordCount,
      };
    } catch (error) {
      console.error('💥 AI Vision complete failure:', error);
      return {
        text: '',
        method: 'ai_vision',
        success: false,
        error: `Failed to extract text: ${(error as Error).message}`,
        wordCount: 0,
      };
    }
  }

  //Check if file type is supported for text extraction
  isImageFile(fileType: string): boolean {
    return SUPPORTED_IMAGE_TYPES.includes(fileType as SupportedImageType);
  }

  //Validate if file can be processed
  canProcessFile(file: File): { canProcess: boolean; reason?: string } {
    if (!this.isImageFile(file.type)) {
      return {
        canProcess: false,
        reason: `Unsupported file type: ${file.type}. Supported types: ${SUPPORTED_IMAGE_TYPES.join(
          ', '
        )}`,
      };
    }

    // Check file size (optional limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        canProcess: false,
        reason: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size: 10MB`,
      };
    }

    return { canProcess: true };
  }
}

export const aiImageService = new AiImageService();
