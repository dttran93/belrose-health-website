import {
  AIProcessingInput,
  AIProcessingResult,
  AIProcessingConfig,
  AIProcessingError,
  DEFAULT_AI_CONFIG,
} from './aiRecordProcessingService.type';

// ==================== AI RECORD PROCESSING SERVICE ====================

/**
 * Simple service for processing FHIR records with AI
 */
export class AIRecordProcessingService {
  private config: Required<AIProcessingConfig>;

  constructor(config: AIProcessingConfig = {}) {
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
  }

  /**
   * Main method to process a FHIR record with AI
   */
  async processRecord(input: AIProcessingInput): Promise<AIProcessingResult> {
    console.log('🤖 Starting AI processing for record...');

    // Validate input
    this.validateInput(input);

    // Call AI processing
    const result = await this.performAIProcessing(input);

    console.log('✅ AI processing completed successfully');
    return result;
  }

  /**
   * Call your Firebase Cloud Function for AI processing
   */
  private async performAIProcessing(input: AIProcessingInput): Promise<AIProcessingResult> {
    console.log('🧠 Calling AI service...');

    try {
      // Call your Firebase Cloud Function
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fhirData: input.fhirData,
          fileName: input.fileName,
          extractedText: input.extractedText,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      // Basic validation that we got the expected fields
      if (!this.isValidResult(result)) {
        throw new Error('AI service returned invalid response format');
      }

      return result;
    } catch (error) {
      console.error('AI service call failed:', error);
      throw new AIProcessingError('AI processing failed', error);
    }
  }

  /**
   * Basic validation of AI result
   */
  private isValidResult(result: any): result is AIProcessingResult {
    return (
      result &&
      typeof result === 'object' &&
      typeof result.visitType === 'string' &&
      typeof result.title === 'string' &&
      typeof result.summary === 'string' &&
      typeof result.completedDate === 'string' &&
      typeof result.provider === 'string' &&
      typeof result.institution === 'string' &&
      typeof result.patient === 'string'
    );
  }

  /**
   * Validate input data
   */
  private validateInput(input: AIProcessingInput): void {
    if (!input) {
      throw new AIProcessingError('Input is required for AI processing');
    }

    if (!input.fhirData) {
      throw new AIProcessingError('FHIR data is required for AI processing');
    }

    if (typeof input.fhirData !== 'object') {
      throw new AIProcessingError('FHIR data must be a valid object');
    }
  }
}

// ==================== EXPORTED FUNCTIONS ====================

/**
 * Simple convenience function for processing a record
 */
export async function processRecordWithAI(
  fhirData: any,
  options: {
    fileName?: string;
    extractedText?: string;
    apiEndpoint?: string;
  } = {}
): Promise<AIProcessingResult> {
  const config: AIProcessingConfig = {};

  if (options.apiEndpoint) {
    config.apiEndpoint = 'https://us-central1-belrose-757fe.cloudfunctions.net/createBelroseFields';
  }

  const service = new AIRecordProcessingService(config);

  return service.processRecord({
    fhirData,
    fileName: options.fileName,
    extractedText: options.extractedText,
  });
}

/**
 * Create a service instance
 */
export function createAIProcessingService(apiEndpoint?: string): AIRecordProcessingService {
  return new AIRecordProcessingService({ apiEndpoint });
}

// ==================== DEFAULT EXPORT ====================

export default AIRecordProcessingService;
