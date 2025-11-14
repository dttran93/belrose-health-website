import { BelroseFields } from '@/types/core';
import { FHIRProcessingRequest } from 'functions/src/index.types';

/**
 * Error class for AI processing failures
 */
class AIProcessingError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'AIProcessingError';
  }
}

// ==================== AI RECORD PROCESSING SERVICE ====================

const AI_ENDPOINT = 'https://us-central1-belrose-757fe.cloudfunctions.net/createBelroseFields';

/**
 * Process a FHIR record with AI to generate Belrose fields
 */
export async function createBelroseFields(input: FHIRProcessingRequest): Promise<BelroseFields> {
  console.log('🤖 Starting AI processing for record...');

  // Validate input
  if (!input) {
    throw new AIProcessingError('Input is required for AI processing');
  }

  if (!input.fhirData) {
    throw new AIProcessingError('FHIR data is required for AI processing');
  }

  if (typeof input.fhirData !== 'object') {
    throw new AIProcessingError('FHIR data must be a valid object');
  }

  // Call AI service
  console.log('🧠 Calling AI service...');

  try {
    console.log('Client sending JSON:', {
      fhirData: input.fhirData,
      fileName: input.fileName,
      extractedText: input.extractedText,
      contextText: input.contextText,
    });

    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fhirData: input.fhirData,
        fileName: input.fileName,
        extractedText: input.extractedText,
        contextText: input.contextText,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    // Validate response
    if (!isValidBelroseFields(result)) {
      throw new Error('AI service returned invalid response format');
    }

    console.log('✅ AI processing completed successfully');
    return result;
  } catch (error) {
    console.error('AI service call failed:', error);
    throw new AIProcessingError('AI processing failed', error);
  }
}

/**
 * Validate that the AI response has the expected BelroseFields structure
 */
function isValidBelroseFields(result: any): result is BelroseFields {
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

export default createBelroseFields;
