// functions/src/handlers/convertToFHIR.ts

import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { defineSecret } from 'firebase-functions/params';
import { AnthropicService, MODELS } from '../services/anthropicService';
import { getFHIRConversionPrompt } from '../utils/prompts';
import type { FHIRConversionRequest, FHIRConversionResponse } from '../../../src/types/sharedApi';

/**
 * FHIR Conversion Handler
 * Converts medical document text into FHIR format using AI
 */

// Define the secret
const anthropicKey = defineSecret('ANTHROPIC_KEY');

/**
 * Convert To FHIR Function
 * Takes raw medical document text and converts it to a FHIR Bundle
 *
 * Input: { documentText: string }
 * Output: FHIR Bundle (JSON)
 */
export const convertToFHIR = onRequest(
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
      // Extract and validate request body
      const { documentText } = req.body as FHIRConversionRequest;

      if (!documentText || typeof documentText !== 'string') {
        res.status(400).json({
          error: 'documentText is required and must be a string',
        });
        return;
      }

      // Get API key
      const apiKey = anthropicKey.value();
      if (!apiKey) {
        console.error('❌ Anthropic API key not configured');
        res.status(500).json({ error: 'API key not configured' });
        return;
      }

      console.log('📄 Converting document to FHIR...', {
        textLength: documentText.length,
      });

      // Create Anthropic service
      const anthropicService = new AnthropicService(apiKey);

      // Generate prompt and call AI
      const prompt = getFHIRConversionPrompt(documentText);
      const responseText = await anthropicService.sendTextMessage(prompt, {
        model: MODELS.SONNET, // Use smart model for complex conversion
        maxTokens: 8000,
        temperature: 0.1,
      });

      // Parse the AI response into FHIR format
      const fhirJson: FHIRConversionResponse = AnthropicService.parseJSONResponse(responseText);

      // Validate that we got a proper FHIR Bundle
      if (!fhirJson.resourceType || fhirJson.resourceType !== 'Bundle') {
        throw new Error('Response is not a valid FHIR Bundle');
      }

      console.log('✅ FHIR conversion successful');
      res.json(fhirJson);
    } catch (error) {
      console.error('❌ FHIR conversion error:', error);
      handleConversionError(res, error);
    }
  }
);

/**
 * Handle FHIR conversion errors
 */
function handleConversionError(res: Response, error: any): void {
  if (error.message?.includes('JSON') || error.message?.includes('parse')) {
    res.status(500).json({
      error: 'Failed to parse FHIR response from AI',
      details: 'The AI returned invalid JSON format',
    });
  } else if (error.message?.includes('Anthropic') || error.name === 'AnthropicAPIError') {
    res.status(502).json({
      error: 'External AI service error',
      details: 'Unable to connect to AI service',
    });
  } else if (error.message?.includes('Bundle')) {
    res.status(500).json({
      error: 'Invalid FHIR format',
      details: 'The response is not a valid FHIR Bundle',
    });
  } else {
    res.status(500).json({
      error: 'Internal server error',
      details: 'An unexpected error occurred during FHIR conversion',
    });
  }
}
