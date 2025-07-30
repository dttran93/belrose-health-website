import {
  AIMedicalDetectionResult,
  MedicalDetectionOptions,
  IAIMedicalDetectionService,
  MedicalDetectionRequest,
  MedicalDetectionAPIResponse,
  MedicalDetectionError,
  MedicalDetectionErrorCode,
  MedicalSpecialty,
  DocumentType
} from './aiMedicalDetectionService.types';

/**
 * Service for AI-powered medical document detection
 * Uses external AI API with intelligent fallback to keyword-based detection
 */
export class AIMedicalDetectionService implements IAIMedicalDetectionService {
  private readonly apiUrl: string;
  private readonly fallbackKeywords: string[];

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl || 'https://us-central1-belrose-757fe.cloudfunctions.net/detectMedicalRecord';
    
    // Comprehensive medical keywords for fallback detection
    this.fallbackKeywords = [
      'patient', 'diagnosis', 'medication', 'prescription', 'doctor', 'physician',
      'hospital', 'clinic', 'medical', 'treatment', 'symptoms', 'blood pressure',
      'heart rate', 'lab results', 'radiology', 'pathology', 'vital signs',
      'allergies', 'chief complaint', 'history of present illness', 'physical exam',
      'assessment', 'plan', 'icd', 'cpt', 'dosage', 'mg', 'ml', 'units',
      'temperature', 'pulse', 'respiratory', 'oxygen saturation', 'bpm', 'pain', 'heart', 
      'injury', 'surgery', 'procedure', 'follow-up', 'referral', 'consultation', 'x-ray',
      'ct scan', 'mri', 'ultrasound', 'echocardiogram', 'blood test', 'urinalysis',
      'biopsy', 'imaging', 'diagnostic', 'treatment plan', 'discharge', 'admission'
    ];
  }

  /**
   * Use AI to detect if a document is medical-related
   */
  async detectMedicalRecord(
    extractedText: string, 
    fileName: string = '', 
    fileType: string = '',
    options: MedicalDetectionOptions = {}
  ): Promise<AIMedicalDetectionResult> {
    try {
      console.log(`🔍 Starting medical detection for: ${fileName || 'text input'}`);

      // Validate input
      if (!extractedText || extractedText.trim().length < 10) {
        return this.createMinimalResult(false, 0, 'insufficient_text', 
          'Insufficient text content for analysis',
          'Unable to extract sufficient text for analysis'
        );
      }

      // Check for obvious medical imaging files first
      if (this.isMedicalImageFile(fileName, fileType)) {
        return this.createMinimalResult(true, 0.95, 'medical_imaging',
          'Medical imaging file format detected',
          'This appears to be a medical imaging file'
        );
      }

      // Call AI detection API
      const detection = await this.callAIDetectionAPI(extractedText, fileName, fileType, options);
      
      console.log(`✅ AI medical detection completed with confidence: ${detection.confidence}`);
      return detection;

    } catch (error: any) {
      console.error('❌ AI Medical detection error:', error);
      
      // Fallback to basic keyword detection if AI fails
      console.log('🔄 Falling back to keyword-based detection');
      return this.fallbackDetection(extractedText);
    }
  }

  /**
   * Check if file is a medical imaging format
   */
  isMedicalImageFile(fileName: string, fileType: string): boolean {
    const lowerFileName = fileName.toLowerCase();
    const lowerFileType = fileType.toLowerCase();
    
    const medicalExtensions = ['.dcm', '.dicom', '.nii', '.nii.gz', '.mha', '.mhd'];
    const hasMedialExtension = medicalExtensions.some(ext => lowerFileName.endsWith(ext));
    const isMedicalMimeType = lowerFileType.includes('dicom') || lowerFileType.includes('medical');
    
    return hasMedialExtension || isMedicalMimeType;
  }

  /**
   * Validate extracted text for medical detection
   */
  validateTextForDetection(text: string): { valid: boolean; error?: string } {
    if (!text || typeof text !== 'string') {
      return { valid: false, error: 'Text must be a non-empty string' };
    }

    if (text.trim().length < 10) {
      return { valid: false, error: 'Text must be at least 10 characters long' };
    }

    if (text.length > 50000) {
      return { valid: false, error: 'Text too long for analysis (max 50,000 characters)' };
    }

    return { valid: true };
  }

  /**
   * Get medical detection statistics
   */
  getDetectionStats(results: AIMedicalDetectionResult[]): DetectionStats {
    const total = results.length;
    const medical = results.filter(r => r.isMedical).length;
    const highConfidence = results.filter(r => r.confidence > 0.8).length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / total;

    return {
      total,
      medical,
      nonMedical: total - medical,
      highConfidence,
      averageConfidence: avgConfidence,
      medicalPercentage: (medical / total) * 100
    };
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Call the external AI detection API
   */
  private async callAIDetectionAPI(
    text: string, 
    fileName: string, 
    fileType: string,
    options: MedicalDetectionOptions
  ): Promise<AIMedicalDetectionResult> {
    
    const requestBody: MedicalDetectionRequest = {
      documentText: text,
      fileName,
      fileType,
      options
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      
      try {
        const errorData: { error?: string } = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If we can't parse error response, use the status message
      }
      
      throw new MedicalDetectionError(
        errorMessage,
        this.mapHTTPStatusToErrorCode(response.status),
        response.status
      );
    }

    const apiResult: MedicalDetectionAPIResponse = await response.json();
    
    // Validate and transform API response
    return this.transformAPIResponse(apiResult);
  }

  /**
   * Transform API response to our internal format
   */
  private transformAPIResponse(apiResponse: MedicalDetectionAPIResponse): AIMedicalDetectionResult {
    // Validate required fields
    if (typeof apiResponse.isMedical !== 'boolean') {
      throw new MedicalDetectionError('Invalid API response: missing isMedical', 'API_ERROR');
    }

    if (typeof apiResponse.confidence !== 'number') {
      throw new MedicalDetectionError('Invalid API response: missing confidence', 'API_ERROR');
    }

    // Ensure confidence is in valid range
    const confidence = Math.max(0, Math.min(1, apiResponse.confidence));

    return {
      isMedical: apiResponse.isMedical,
      confidence,
      detectedTerms: apiResponse.detectedTerms || [],
      reasoning: apiResponse.reasoning || 'AI analysis completed',
      documentType: apiResponse.documentType || 'unknown',
      suggestion: apiResponse.suggestion,
      medicalSpecialty: apiResponse.medicalSpecialty,
      structuredData: apiResponse,
      source: 'ai_analysis'
    };
  }

  /**
   * Fallback detection using basic keywords if AI fails
   */
  private fallbackDetection(text: string): AIMedicalDetectionResult {
    console.log('🔍 Running fallback keyword-based medical detection');
    
    const lowerText = text.toLowerCase();
    
    const detectedTerms = this.fallbackKeywords.filter(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );

    const medicalMatches = detectedTerms.length;
    
    // Require at least 2 medical terms for positive detection
    const isMedical = medicalMatches >= 2;
    
    // Calculate confidence based on number of matches (capped at 0.7 for fallback)
    const confidence = isMedical ? Math.min(medicalMatches / 10, 0.7) : 0.1;

    return {
      isMedical,
      confidence,
      detectedTerms,
      reasoning: `Fallback keyword-based detection (AI service unavailable) - Found ${medicalMatches} medical terms: ${detectedTerms.slice(0, 5).join(', ')}${detectedTerms.length > 5 ? '...' : ''}`,
      documentType: isMedical ? 'medical_record' : 'unknown',
      suggestion: isMedical 
        ? `Appears to be medical-related based on ${medicalMatches} medical keywords found`
        : 'No sufficient medical terminology detected',
      source: 'ai_analysis'
    };
  }

  /**
   * Create a minimal detection result
   */
  private createMinimalResult(
    isMedical: boolean, 
    confidence: number, 
    documentType: string, 
    reasoning: string, 
    suggestion: string
  ): AIMedicalDetectionResult {
    return {
      isMedical,
      confidence,
      detectedTerms: [],
      reasoning,
      documentType,
      suggestion,
      source: 'ai_analysis'
    };
  }

  /**
   * Map HTTP status codes to our error codes
   */
  private mapHTTPStatusToErrorCode(status: number): MedicalDetectionErrorCode {
    switch (status) {
      case 400:
        return 'INVALID_INPUT';
      case 401:
      case 403:
        return 'AUTHENTICATION_FAILED';
      case 429:
        return 'QUOTA_EXCEEDED';
      case 500:
      case 502:
      case 503:
        return 'API_ERROR';
      default:
        return 'NETWORK_ERROR';
    }
  }
}

// ==================== ADDITIONAL INTERFACES ====================

interface DetectionStats {
  total: number;
  medical: number;
  nonMedical: number;
  highConfidence: number;
  averageConfidence: number;
  medicalPercentage: number;
}

// ==================== EXPORT PATTERNS ====================

// Create a singleton instance for backward compatibility
const aiMedicalDetectionService = new AIMedicalDetectionService();

// Export the instance as default (matches original pattern)
export default aiMedicalDetectionService;

// Export the class for advanced usage (different name to avoid conflict)
export { AIMedicalDetectionService as AIMedicalDetectionServiceClass };

// Export the singleton instance with the same name as the original
export { aiMedicalDetectionService };