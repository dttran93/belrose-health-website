import {
  NarrativeGenerationInput,
  NarrativeGenerationResult,
  NarrativeGenerationConfig,
  NarrativeGenerationError,
  DEFAULT_NARRATIVE_CONFIG,
} from '../../../../functions/src/index.types';

// ==================== NARRATIVE GENERATION SERVICE ====================

/**
 * Service for generating detailed narratives from FHIR records
 */
export class NarrativeGenerationService {
  private config: Required<NarrativeGenerationConfig>;

  constructor(config: NarrativeGenerationConfig = {}) {
    this.config = { ...DEFAULT_NARRATIVE_CONFIG, ...config };
  }

  /**
   * Main method to generate a detailed narrative
   */
  async generateNarrative(input: NarrativeGenerationInput): Promise<NarrativeGenerationResult> {
    console.log('📖 Starting detailed narrative generation...');

    // Validate input
    this.validateInput(input);

    // Call narrative generation
    const result = await this.performNarrativeGeneration(input);

    console.log('✅ Narrative generation completed successfully');
    return result;
  }

  /**
   * Call your Firebase Cloud Function for narrative generation
   */
  private async performNarrativeGeneration(
    input: NarrativeGenerationInput
  ): Promise<NarrativeGenerationResult> {
    console.log('🧠 Calling narrative generation service...');

    try {
      // Call your Firebase Cloud Function
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fhirData: input.fhirData,
          belroseFields: input.belroseFields,
          fileName: input.fileName,
          extractedText: input.extractedText,
          originalText: input.originalText,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Narrative API returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      // Basic validation that we got a narrative
      if (!this.isValidResult(result)) {
        throw new Error('Narrative service returned invalid response format');
      }

      return result;
    } catch (error) {
      console.error('Narrative service call failed:', error);
      throw new NarrativeGenerationError('Narrative generation failed', error);
    }
  }

  /**
   * Basic validation of narrative result
   */
  private isValidResult(result: any): result is NarrativeGenerationResult {
    return result && typeof result === 'object' && typeof result.detailedNarrative === 'string';
  }

  /**
   * Validate input data
   */
  private validateInput(input: NarrativeGenerationInput): void {
    if (!input) {
      throw new NarrativeGenerationError('Input is required for narrative generation');
    }

    if (!input.fhirData) {
      throw new NarrativeGenerationError('FHIR data is required for narrative generation');
    }

    if (typeof input.fhirData !== 'object') {
      throw new NarrativeGenerationError('FHIR data must be a valid object');
    }
  }
}

// ==================== EXPORTED FUNCTIONS ====================

/**
 * Simple convenience function for generating a narrative
 */
export async function generateDetailedNarrative(
  fhirData: any,
  options: {
    belroseFields?: NarrativeGenerationInput['belroseFields'];
    fileName?: string;
    extractedText?: string;
    originalText?: string;
    apiEndpoint?: string;
  } = {}
): Promise<NarrativeGenerationResult> {
  const config: NarrativeGenerationConfig = {};

  if (options.apiEndpoint) {
    config.apiEndpoint = options.apiEndpoint;
  }

  const service = new NarrativeGenerationService(config);

  return service.generateNarrative({
    fhirData,
    belroseFields: options.belroseFields,
    fileName: options.fileName,
    extractedText: options.extractedText,
    originalText: options.originalText,
  });
}

/**
 * Create a service instance
 */
export function createNarrativeGenerationService(apiEndpoint?: string): NarrativeGenerationService {
  return new NarrativeGenerationService({ apiEndpoint });
}

export default NarrativeGenerationService;
