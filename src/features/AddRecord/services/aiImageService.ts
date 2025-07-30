import type {
  AnalysisRequest,
  AnalysisType,
  FullAnalysisResult,
  MedicalDetectionResult,
  ApiErrorResponse,
  SupportedImageType
} from './aiImageService.type';

import {
  SUPPORTED_IMAGE_TYPES,
  MEDICAL_FILE_EXTENSIONS
} from './aiImageService.type';

export class AiImageService {
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = 'https://us-central1-belrose-757fe.cloudfunctions.net/analyzeImageWithAI';
  }

  /**
   * Convert file to base64 for AI Vision API
   */
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
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get media type for API
   */
  getMediaType(fileType: string): string {
    const mimeTypeMap: Record<string, string> = {
      'image/jpeg': 'image/jpeg',
      'image/jpg': 'image/jpeg', 
      'image/png': 'image/png',
      'image/gif': 'image/gif',
      'image/webp': 'image/webp'
    };
    return mimeTypeMap[fileType] || 'image/jpeg';
  }

  /**
   * Analyze image with AI Vision for medical content detection and text extraction
   */
  async analyzeImage(file: File, analysisType: AnalysisType = 'full'): Promise<FullAnalysisResult> {
    try {
      const base64Image = await this.fileToBase64(file);
      const mediaType = this.getMediaType(file.type);

      const requestBody: AnalysisRequest = {
        image: {
          base64: base64Image,
          mediaType: mediaType
        },
        fileName: file.name,
        fileType: file.type,
        analysisType: analysisType
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result: FullAnalysisResult = await response.json();
      return result;

    } catch (error) {
      console.error('AI Vision analysis error:', error);
      throw new Error(`Failed to analyze image: ${(error as Error).message}`);
    }
  }

  /**
   * Extract text from image using AI Vision
   */
  async extractTextFromImage(file: File): Promise<string> {
    try {
      const result = await this.analyzeImage(file, 'extraction');
      return result.extractedText ?? ''; // Use nullish coalescing instead of ||
    } catch (error) {
      console.error('Error extracting text with AI Vision:', error);
      // Fallback to Tesseract if AI fails
      throw error;
    }
  }

  /**
   * Detect if image contains medical content
   */
  async detectMedicalContent(file: File): Promise<MedicalDetectionResult> {
    try {
      const result = await this.analyzeImage(file, 'detection');
      return {
        isMedical: result.isMedical,
        confidence: result.confidence,
        documentType: result.documentType,
        reasoning: result.reasoning,
        suggestion: result.suggestion
      };
    } catch (error) {
      console.error('Error detecting medical content:', error);
      throw error;
    }
  }

  /**
   * Full analysis: detection + text extraction + classification
   */
  async analyzeImageFull(file: File): Promise<FullAnalysisResult> {
    try {
      const result = await this.analyzeImage(file, 'full');
      return {
        // Medical detection
        isMedical: result.isMedical,
        confidence: result.confidence,
        documentType: result.documentType,
        reasoning: result.reasoning,
        suggestion: result.suggestion,
        
        // Text extraction
        extractedText: result.extractedText,
        
        // Additional insights
        medicalSpecialty: result.medicalSpecialty,
        structuredData: result.structuredData, // Any structured medical data found
        
        // Quality assessment
        imageQuality: result.imageQuality,
        readabilityScore: result.readabilityScore
      };
    } catch (error) {
      console.error('Error in full image analysis:', error);
      throw error;
    }
  }

  /**
   * Check if file is a medical imaging format
   */
  isMedicalImageFile(fileName: string, fileType: string): boolean {
    const lowerFileName = fileName.toLowerCase();
    const lowerFileType = fileType.toLowerCase();
    
    const hasMedialExtension = MEDICAL_FILE_EXTENSIONS.some((ext: string) => lowerFileName.endsWith(ext));
    const isMedicalMimeType = lowerFileType.includes('dicom') || lowerFileType.includes('medical');
    
    return hasMedialExtension || isMedicalMimeType;
  }
}

// Export singleton instance
export const aiImageService = new AiImageService();