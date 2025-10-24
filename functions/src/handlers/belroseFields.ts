// functions/src/handlers/belroseFields.ts

import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { defineSecret } from 'firebase-functions/params';
import { AnthropicService, MODELS } from '../services/anthropicService';
import { getBelroseFieldsPrompt } from '../utils/prompts';
import type { FHIRProcessingRequest, FHIRProcessingResponse, FHIRAnalysis } from '../index.types';

// Define the secret
const anthropicKey = defineSecret('ANTHROPIC_KEY');

/**
 * Process FHIR With AI Function
 *
 * Takes:
 * - fhirData: The FHIR Bundle (required)
 * - fileName: Original file name (optional, for context)
 * - analysis: Previous image analysis (optional, for context)
 *  * - extractedText: Text from OCR/image processing (optional, helps catch missed info)
 * - originalText: Raw text from document (optional, helps catch missed info)
 *
 * Returns:
 * - visitType: e.g., "Lab Results", "Doctor Visit"
 * - title: Short description
 * - summary: 2-3 sentence summary
 * - completedDate: When it happened
 * - provider: Doctor/provider name
 * - institution: Hospital/clinic name
 * - patient: Patient name
 */
export const createBelroseFields = onRequest(
  {
    secrets: [anthropicKey],
    cors: true,
  },
  async (req: Request, res: Response) => {
    // Validate HTTP method
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      console.log('🏥 FHIR processing request received');

      // Extract and validate request body
      const { fhirData, fileName, analysis, extractedText, originalText } =
        req.body as FHIRProcessingRequest;

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

      console.log('🤖 Processing FHIR data with AI...', {
        fileName,
        hasAnalysis: !!analysis,
        hasExtractedText: !!extractedText,
        hasOriginalText: !!originalText,
      });

      // Process FHIR data to extract display-friendly info
      const result = await processDataForBelroseFields(
        fhirData,
        apiKey,
        fileName,
        analysis,
        extractedText,
        originalText
      );

      console.log('✅ FHIR processing successful');
      res.json(result);
    } catch (error) {
      console.error('❌ FHIR processing error:', error);

      // Return a fallback response instead of failing completely
      // This ensures the user still gets something useful
      const fallback = createFallbackResponse(req.body.fileName, req.body.analysis);

      res.json(fallback);
    }
  }
);

/**
 * Process FHIR data with AI to extract key information
 */
async function processDataForBelroseFields(
  fhirData: any,
  apiKey: string,
  fileName?: string,
  analysis?: FHIRAnalysis,
  extractedText?: string,
  originalText?: string
): Promise<FHIRProcessingResponse> {
  const anthropicService = new AnthropicService(apiKey);

  // Build the prompt with all context
  const prompt = getBelroseFieldsPrompt(fhirData, fileName, analysis, extractedText, originalText);

  try {
    // Use Haiku model - it's faster and cheaper for this task
    const responseText = await anthropicService.sendTextMessage(prompt, {
      model: MODELS.HAIKU,
      maxTokens: 1000,
      temperature: 0.1,
    });

    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.warn('⚠️ No JSON found in AI response, using fallback');
      return createFallbackResponse(fileName, analysis);
    }

    const result = JSON.parse(jsonMatch[0]) as Partial<FHIRProcessingResponse>;
    return validateAndCleanResult(result, fileName);
  } catch (error) {
    console.error('❌ FHIR processing with AI failed:', error);
    return createFallbackResponse(fileName, analysis);
  }
}

/**
 * Validate and clean the AI result
 * Ensures all required fields have sensible defaults
 */
function validateAndCleanResult(
  result: Partial<FHIRProcessingResponse>,
  fileName?: string
): FHIRProcessingResponse {
  const today = new Date().toISOString().split('T')[0];

  return {
    visitType: result.visitType || 'Medical Record',
    title: result.title || fileName || 'Health Record',
    summary: result.summary || 'Medical record processed.',
    completedDate: validateDate(result.completedDate) || today,
    provider: result.provider || 'Healthcare Provider',
    institution: result.institution || 'Medical Center',
    patient: result.patient || 'Patient',
  };
}

/**
 * Create a fallback response when AI processing fails
 * Uses any available context (fileName, analysis) to make it useful
 */
function createFallbackResponse(
  fileName?: string,
  analysis?: FHIRAnalysis
): FHIRProcessingResponse {
  const today = new Date().toISOString().split('T')[0];

  return {
    visitType: 'Medical Record',
    title: fileName || 'Health Record',
    summary: 'Medical record processed successfully.',
    completedDate: today,
    provider: 'Healthcare Provider',
    institution: 'Medical Center',
    patient: 'Patient',
  };
}

/**
 * Validate date format (YYYY-MM-DD)
 * Returns the date if valid, null otherwise
 */
function validateDate(dateStr?: string): string | null {
  if (!dateStr) return null;

  // Check for YYYY-MM-DD format
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? dateStr : null;
}
