// ==================== INPUT/OUTPUT TYPES ====================

/**
 * Input for AI processing - the FHIR data to analyze
 */
export interface AIProcessingInput {
  fhirData: any;
  fileName?: string;
  extractedText?: string;
}

/**
 * Result from AI processing
 */
export interface AIProcessingResult {
  visitType: string;
  title: string;
  summary: string;
  completedDate?: string;
  provider: string;
  institution: string;
}

// ==================== CONFIGURATION ====================

/**
 * Configuration for AI processing
 */
export interface AIProcessingConfig {
  timeout?: number; // milliseconds
  retryAttempts?: number;
  model?: string;
  apiEndpoint?: string;
  apiKey?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_AI_CONFIG: Required<AIProcessingConfig> = {
  timeout: 30000, // 30 seconds
  retryAttempts: 2,
  model: 'gpt-4',
  apiEndpoint: '/api/ai/process-fhir',
  apiKey: ''
};

// ==================== ERROR HANDLING ====================

/**
 * Error codes for AI processing failures
 */
export type AIProcessingErrorCode = 
  | 'INVALID_FHIR_DATA'
  | 'AI_SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'PROCESSING_FAILED'
  | 'INSUFFICIENT_DATA'
  | 'API_KEY_MISSING'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNKNOWN_ERROR';

/**
 * Custom error class for AI processing
 */
export class AIProcessingError extends Error {
  constructor(
    message: string,
    public code: AIProcessingErrorCode,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AIProcessingError';
  }
}

// ==================== INTERNAL PROCESSING TYPES ====================

/**
 * Internal structure for FHIR resource analysis
 */
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

/**
 * Processing context passed between methods
 */
export interface ProcessingContext {
  input: AIProcessingInput;
  analysis: FHIRAnalysis;
  attempt: number;
  startTime: number;
}

// ==================== SERVICE INTERFACE ====================

/**
 * Interface for AI processing services
 * Useful if you want to create multiple implementations
 */
export interface IAIRecordProcessingService {
  processRecord(input: AIProcessingInput): Promise<AIProcessingResult>;
}

// ==================== MOCK/TEST TYPES ====================

/**
 * Configuration for mock behavior (for testing)
 */
export interface MockConfig {
  enabled: boolean;
  delay?: number;
  failureRate?: number; // 0-1, chance of random failure
  customResponses?: Partial<AIProcessingResult>;
}