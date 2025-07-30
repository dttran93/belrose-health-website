// ==================== AI MEDICAL DETECTION TYPES ====================

export interface AIMedicalDetectionResult {
  isMedical: boolean;
  confidence: number;
  detectedTerms?: string[];
  reasoning?: string;
  documentType?: string;
  suggestion?: string;
  
  // Enhanced AI detection fields
  medicalSpecialty?: string;
  structuredData?: any;
  source?: 'ai_analysis';
}

export interface MedicalDetectionOptions {
  confidenceThreshold?: number;
  enableTermDetection?: boolean;
  includeReasoning?: boolean;
  language?: string;
}

// ==================== SERVICE INTERFACE ====================

export interface IAIMedicalDetectionService {
  detectMedicalRecord(
    extractedText: string, 
    fileName?: string, 
    fileType?: string,
    options?: MedicalDetectionOptions
  ): Promise<AIMedicalDetectionResult>;
  
  // Additional methods that might exist
  isMedicalImageFile?(fileName: string, fileType: string): boolean;
}

// ==================== API REQUEST/RESPONSE TYPES ====================

export interface MedicalDetectionRequest {
  documentText: string;
  fileName?: string;
  fileType?: string;
  options?: MedicalDetectionOptions;
}

export interface MedicalDetectionAPIResponse {
  isMedical: boolean;
  confidence: number;
  documentType?: string;
  reasoning?: string;
  suggestion?: string;
  detectedTerms?: string[];
  medicalSpecialty?: string;
  error?: string;
}

// ==================== ERROR TYPES ====================

export class MedicalDetectionError extends Error {
  constructor(
    message: string,
    public code: MedicalDetectionErrorCode,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'MedicalDetectionError';
  }
}

export type MedicalDetectionErrorCode = 
  | 'API_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_INPUT'
  | 'QUOTA_EXCEEDED'
  | 'AUTHENTICATION_FAILED'
  | 'UNKNOWN_ERROR';

// ==================== UTILITY TYPES ====================

export type MedicalSpecialty = 
  | 'cardiology'
  | 'radiology' 
  | 'pathology'
  | 'laboratory'
  | 'pharmacy'
  | 'surgery'
  | 'general_medicine'
  | 'unknown';

export type DocumentType = 
  | 'lab_report'
  | 'medical_imaging'
  | 'prescription'
  | 'patient_record'
  | 'discharge_summary'
  | 'consultation_note'
  | 'unknown';