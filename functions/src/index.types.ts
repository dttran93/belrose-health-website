// functions/src/types/index.ts

// ==================== SHARED TYPES ====================

export interface APIResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  details?: string;
}

export interface BaseRequest {
  documentText?: string;
  fileName?: string;
  fileType?: string;
}

// ==================== FHIR CONVERSION TYPES ====================

export interface FHIRConversionRequest extends BaseRequest {
  documentText: string;
  documentType?: string;
}

export interface FHIRConversionResponse {
  resourceType: 'Bundle';
  entry: Array<{
    resource: any;
  }>;
  [key: string]: any;
}

// ==================== MEDICAL DETECTION TYPES ====================

export interface MedicalDetectionRequest extends BaseRequest {
  documentText: string;
}

export interface MedicalDetectionResponse {
  isMedical: boolean;
  confidence: number;
  documentType: 
    | 'medical_record'
    | 'lab_results' 
    | 'radiology_report'
    | 'prescription'
    | 'discharge_summary'
    | 'consultation_notes'
    | 'medical_imaging'
    | 'insurance_document'
    | 'business_document'
    | 'invoice'
    | 'receipt'
    | 'personal_document'
    | 'unknown';
  reasoning: string;
  medicalSpecialty?: string | null;
  suggestion: string;
  detectedAt?: string;
}

// ==================== IMAGE ANALYSIS TYPES ====================

export interface ImageData {
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

export interface ImageAnalysisRequest {
  image: ImageData;
  fileName?: string;
  fileType?: string;
  analysisType?: 'detection' | 'extraction' | 'full';
}

export interface ImageAnalysisResponse {
  isMedical?: boolean;
  confidence?: number;
  documentType?: string;
  reasoning?: string;
  suggestion?: string;
  extractedText?: string;
  medicalSpecialty?: string | null;
  structuredData?: {
    patientName?: string | null;
    patientId?: string | null;
    date?: string | null;
    provider?: string | null;
    facility?: string | null;
    testResults?: any[] | null;
    medications?: any[] | null;
    diagnoses?: any[] | null;
  };
  imageQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  readabilityScore?: number;
  analyzedAt?: string;
  fileName?: string;
  fileType?: string;
  analysisType?: string;
}

// ==================== FHIR PROCESSING TYPES ====================

export interface FHIRProcessingRequest {
  fhirData: any;
  fileName?: string;
  analysis?: FHIRAnalysis;
}

export interface FHIRAnalysis {
  resourceTypes: string[];
  observations: any[];
  encounters: any[];
  diagnosticReports: any[];
  practitioners: any[];
  organizations: any[];
  patients: any[];
  extractedDates: string[];
}

export interface FHIRProcessingResponse {
  visitType: string;
  title: string;
  summary: string;
  completedDate: string;
  provider: string;
  institution: string;
  patient: string;
}

// ==================== CLAUDE API TYPES ====================

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContent[];
}

export interface ClaudeContent {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
}

export interface ClaudeResponse {
  content: Array<{
    text: string;
    type: string;
  }>;
  id: string;
  model: string;
  role: string;
  stop_reason: string;
  stop_sequence: null;
  type: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ==================== ERROR TYPES ====================

export class CloudFunctionError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'CloudFunctionError';
  }
}

export type ErrorCode = 
  | 'INVALID_REQUEST'
  | 'MISSING_DATA'
  | 'CLAUDE_API_ERROR'
  | 'PROCESSING_FAILED'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';

// ==================== HEALTH CHECK TYPES ====================

export interface HealthCheckResponse {
  status: 'OK' | 'ERROR';
  timestamp: string;
  version?: string;
}