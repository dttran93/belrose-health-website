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
}

export interface FHIRConversionResponse {
  resourceType: 'Bundle';
  entry: Array<{
    resource: any;
  }>;
  [key: string]: any;
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
  extractedText?: string;
  originalText?: string;
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

// ==================== DETAILED NARRATIVE TYPES ====================

export interface NarrativeGenerationInput {
  fhirData: any;
  belroseFields?: {
    visitType?: string;
    title?: string;
    summary?: string;
    completedDate?: string;
    provider?: string;
    institution?: string;
    patient?: string;
  };
  fileName?: string;
  extractedText?: string;
  originalText?: string;
}

export interface NarrativeGenerationResult {
  detailedNarrative: string;
}

export interface NarrativeGenerationConfig {
  apiEndpoint?: string;
}

export const DEFAULT_NARRATIVE_CONFIG: Required<NarrativeGenerationConfig> = {
  apiEndpoint: 'https://us-central1-belrose-757fe.cloudfunctions.net/createDetailedNarrative',
};

/**
 * Custom error class for narrative generation
 */
export class NarrativeGenerationError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'NarrativeGenerationError';
  }
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
  constructor(message: string, public code: string, public statusCode: number = 500) {
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

// ==================== ID VERIFICATION TYPES ====================

export interface PersonaInquiryResponse {
  data: {
    id: string;
    attributes: {
      session_token: string;
      status: 'created' | 'pending' | 'approved' | 'declined' | 'needs_review';
      name_first?: string;
      name_last?: string;
      birthdate?: string;
      address_street_1?: string;
      address_postal_code?: string;
    };
  };
}

export interface VerifiedData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: string;
  postcode: string;
}

export interface CreateSessionResponse {
  sessionToken: string;
  inquiryId: string;
}

export interface CheckStatusRequest {
  inquiryId: string;
}

export interface CheckStatusResponse {
  verified: boolean;
  data?: VerifiedData;
  reason?: string;
}

export interface CreateVerificationSessionRequest {
  templateId: string;
}
