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

export interface ApiErrorResponse {
  error: string;
}

//Medical file extensions and MIME types
export const MEDICAL_FILE_EXTENSIONS = [
  '.dcm',
  '.dicom',
  '.nii',
  '.nii.gz',
  '.mha',
  '.mhd',
] as const;

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];
export type MedicalFileExtension = (typeof MEDICAL_FILE_EXTENSIONS)[number];

import type { TextExtractionResult } from './shared.types';

export class AiImageService {
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = 'https://us-central1-belrose-757fe.cloudfunctions.net/analyzeImageWithAI';
  }

  //Convert file to base64 for AI Vision API
  async fileToBase64(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (): void => {
        const result = reader.result;
        if (typeof result === 'string' && result.includes(',')) {
          // Find the comma and extract everything after it
          const commaIndex = result.indexOf(',');
          const base64Data = result.substring(commaIndex + 1);

          if (base64Data.length > 0) {
            resolve(base64Data);
          } else {
            reject(new Error('Empty base64 data'));
          }
        } else {
          reject(new Error('Failed to read file as data URL or invalid format'));
        }
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  //Get media type for API
  getMediaType(fileType: string): string {
    const mimeTypeMap: Record<string, string> = {
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
      const base64Image = await this.fileToBase64(file);
      console.log('📸 Base64 length:', base64Image.length);

      const mediaType = this.getMediaType(file.type);
      console.log('🔧 Media type:', mediaType);

      const requestBody: AnalysisRequest = {
        image: { base64: base64Image, mediaType: mediaType },
        fileName: file.name,
        fileType: file.type,
        analysisType: 'extraction',
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

  //Get file extension from filename
  getFileExtension(fileName: string): string {
    return fileName.toLowerCase().split('.').pop() || '';
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
