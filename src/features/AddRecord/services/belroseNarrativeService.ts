// Import the backend type for the input
import type { DetailedNarrativeInput } from '../../../../functions/src/handlers/belroseNarrative';

/**
 * Custom error class for narrative generation
 */
class NarrativeGenerationError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'NarrativeGenerationError';
  }
}

interface DetailedNarrative {
  detailedNarrative: string;
}

// ==================== NARRATIVE GENERATION SERVICE ====================

const NARRATIVE_ENDPOINT =
  'https://us-central1-belrose-757fe.cloudfunctions.net/createDetailedNarrative';

/**
 * Generate a detailed human-readable narrative from FHIR data
 *
 * Takes FHIR data and (optionally) existing Belrose fields, and returns
 * a comprehensive narrative description of the medical record.
 *
 * The narrative includes:
 * - What happened during the visit/test
 * - Key findings and observations
 * - Medications, procedures, or treatments
 * - Follow-up recommendations
 */
export async function generateDetailedNarrative(
  input: DetailedNarrativeInput
): Promise<DetailedNarrative> {
  console.log('📖 Starting detailed narrative generation...');

  // Validate input
  if (!input) {
    throw new NarrativeGenerationError('Input is required for narrative generation');
  }

  if (!input.fhirData) {
    throw new NarrativeGenerationError('FHIR data is required for narrative generation');
  }

  if (typeof input.fhirData !== 'object') {
    throw new NarrativeGenerationError('FHIR data must be a valid object');
  }

  // Call narrative generation API
  console.log('🧠 Calling narrative generation service...');

  try {
    const response = await fetch(NARRATIVE_ENDPOINT, {
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
        contextText: input.contextText,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Narrative API returned ${response.status}: ${errorText}`);
    }

    const result: DetailedNarrative = await response.json();

    // Validate response has a narrative
    if (!result || typeof result !== 'object' || typeof result.detailedNarrative !== 'string') {
      throw new Error('Narrative service returned invalid response format');
    }

    console.log('✅ Narrative generation completed successfully');
    return result;
  } catch (error) {
    console.error('❌ Narrative service call failed:', error);
    throw new NarrativeGenerationError('Narrative generation failed', error);
  }
}

export default generateDetailedNarrative;
