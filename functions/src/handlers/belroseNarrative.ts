// functions/src/handlers/belroseNarrative.ts

import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { defineSecret } from 'firebase-functions/params';
import { AnthropicService, MODELS } from '../services/anthropicService';
import { getDetailedNarrativePrompt } from '../utils/prompts';
import type { BelroseFields } from '../../../src/types/core';

// Define the secret
const anthropicKey = defineSecret('ANTHROPIC_KEY');

// ==================== TYPE DEFINITIONS ====================

export interface DetailedNarrativeInput {
  fhirData: any;
  belroseFields?: BelroseFields;
  fileName?: string;
  extractedText?: string;
  originalText?: string;
}

export interface DetailedNarrative {
  detailedNarrative: string;
}

// ==================== CLOUD FUNCTION ====================

/**
 * Create Detailed Narrative Function
 *
 * Takes FHIR data and generates a comprehensive, human-readable narrative
 * Uses Claude Sonnet for better quality narrative generation
 */
export const createDetailedNarrative = onRequest(
  {
    secrets: [anthropicKey],
    cors: true,
    timeoutSeconds: 120, // Longer timeout for narrative generation
  },
  async (req: Request, res: Response) => {
    // Validate HTTP method
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      console.log('📖 Detailed narrative generation request received');

      // Extract and validate request body
      const { fhirData, belroseFields, fileName, extractedText, originalText } =
        req.body as DetailedNarrativeInput;

      if (!fhirData) {
        res.status(400).json({ error: 'fhirData is required' });
        return;
      }

      // Get API key
      const apiKey = anthropicKey.value();
      if (!apiKey) {
        console.error('❌ Anthropic API key not configured');
        res.status(500).json({ error: 'API key not configured' });
        return;
      }

      console.log('🤖 Processing narrative with AI...', {
        fileName,
        hasBelroseFields: !!belroseFields,
        hasExtractedText: !!extractedText,
        hasOriginalText: !!originalText,
      });

      // Generate the narrative
      const result = await generateNarrativeWithAI(
        fhirData,
        apiKey,
        belroseFields,
        fileName,
        extractedText,
        originalText
      );

      console.log('✅ Narrative generation successful');
      res.json(result);
    } catch (error) {
      console.error('❌ Narrative generation error:', error);
      res.status(500).json({
        error: 'Narrative generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate narrative using AI
 */
async function generateNarrativeWithAI(
  fhirData: any,
  apiKey: string,
  belroseFields?: DetailedNarrativeInput['belroseFields'],
  fileName?: string,
  extractedText?: string,
  originalText?: string
): Promise<DetailedNarrative> {
  const anthropicService = new AnthropicService(apiKey);

  // Build the prompt with all context
  const prompt = getDetailedNarrativePrompt(
    fhirData,
    belroseFields,
    fileName,
    extractedText,
    originalText
  );

  try {
    // Use Sonnet model - better reasoning and narrative generation
    const responseText = await anthropicService.sendTextMessage(prompt, {
      model: MODELS.SONNET, // This is Claude Sonnet 3.5 or 4 depending on your setup
      maxTokens: 2000, // Allow for longer narratives
      temperature: 0.3, // Slightly higher for more natural prose
    });

    // The response should be the narrative directly
    // Clean up any potential markdown or extra formatting
    const narrative = responseText.trim();

    if (!narrative || narrative.length < 50) {
      console.warn('⚠️ Generated narrative seems too short, using fallback');
      return createFallbackNarrative(belroseFields, fileName);
    }

    return {
      detailedNarrative: narrative,
    };
  } catch (error) {
    console.error('❌ Narrative generation with AI failed:', error);
    return createFallbackNarrative(belroseFields, fileName);
  }
}

/**
 * Create a fallback narrative when AI generation fails
 */
function createFallbackNarrative(
  belroseFields?: DetailedNarrativeInput['belroseFields'],
  fileName?: string
): DetailedNarrative {
  const title = belroseFields?.title || fileName || 'Health Record';
  const date = belroseFields?.completedDate || new Date().toISOString().split('T')[0];
  const provider = belroseFields?.provider || 'Healthcare Provider';
  const institution = belroseFields?.institution || 'Medical Center';

  const fallbackNarrative = `This is a medical record titled "${title}" dated ${date}. The record was created at ${institution} with ${provider}. ${
    belroseFields?.summary || 'Additional details are available in the structured FHIR data.'
  }`;

  return {
    detailedNarrative: fallbackNarrative,
  };
}
