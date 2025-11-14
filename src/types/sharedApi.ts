//types/api.types.ts
// Types shared between frontend and backend, usually representing API contract

/**
 * ============================================================================
 * IMAGE ANALYSIS API
 * ============================================================================
 */

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

export type AnalysisType = 'detection' | 'extraction' | 'full';

/**
 * Request payload for image analysis API
 * POST /analyzeImageWithAI
 */
export interface ImageAnalysisRequest {
  image: ImageData;
  fileName?: string;
  fileType?: string;
  analysisType?: AnalysisType;
}

/**
 * Response payload from image analysis API
 * POST /analyzeImageWithAI
 */
export interface ImageAnalysisResponse {
  /** Whether the image appears to be medical-related */
  isMedical?: boolean;
  /** Confidence score (0-1) */
  confidence?: number;
  /** AI reasoning for the classification */
  reasoning?: string;
  suggestion?: string;
  extractedText?: string;
  medicalSpecialty?: string | null;
  structuredData?: MedicalStructuredData;
  imageQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  /** Readability score (0-100) */
  readabilityScore?: number;
  analyzedAt?: string;
  fileName?: string;
  fileType?: string;
  analysisType?: string;
}

/**
 * Structured medical data that can be extracted from images
 */
export interface MedicalStructuredData {
  patientName?: string | null;
  patientId?: string | null;
  date?: string | null;
  provider?: string | null;
  facility?: string | null;
  testResults?: MedicalTestResult[] | null;
  medications?: string[] | null;
  diagnoses?: string[] | null;
}

/**
 * Medical test result extracted from an image
 */
export interface MedicalTestResult {
  testName?: string;
  value?: string;
  unit?: string;
  normalRange?: string;
  abnormal?: boolean;
}

/**
 * ============================================================================
 * FHIR CONVERSION API
 * ============================================================================
 */

/**
 * Request payload for FHIR conversion API
 */
export interface FHIRConversionRequest {
  documentText: string;
  fileName?: string;
  fileType?: string;
}

/**
 * Response payload from FHIR conversion API. POST /convertToFHIR
 */
export interface FHIRConversionResponse {
  resourceType: 'Bundle';
  entry: Array<{
    resource: any; // Generic FHIR resource
  }>;
  [key: string]: any;
}

/**
 * ============================================================================
 * BELROSE FIELDS Processing
 * ============================================================================
 */

/**
 * Request payload for Belrose Fields processing
 */
export interface BelroseFieldProcessingRequest {
  fhirData: any;
  extractedText?: string;
  originalText?: string;
  fileName?: string;
  analysis?: FHIRAnalysis;
  contextText?: string;
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
