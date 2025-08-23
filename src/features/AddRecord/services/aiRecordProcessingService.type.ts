// ==================== INPUT/OUTPUT TYPES ====================

/**
 * Input for AI processing
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
  completedDate: string;
  provider: string;
  institution: string;
  patient: string;
}

// ==================== CONFIGURATION ====================

/**
 * Configuration for AI processing
 */
export interface AIProcessingConfig {
  apiEndpoint?: string;
}

/**
 * Default configuration
 */
export const DEFAULT_AI_CONFIG: Required<AIProcessingConfig> = {
  apiEndpoint: 'https://us-central1-belrose-757fe.cloudfunctions.net/processFHIRWithAI'
};

// ==================== ERROR HANDLING ====================

/**
 * Custom error class for AI processing
 */
export class AIProcessingError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'AIProcessingError';
  }
}