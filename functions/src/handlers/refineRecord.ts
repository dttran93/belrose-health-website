// functions/src/handlers/refineRecord.ts

/**
 * refineRecord Cloud Function
 *
 * Takes a plain-English edit request from the user and applies it
 * to the record's FHIR data and Belrose fields.
 *
 * Used from the ViewEditRecord edit screen — record is already
 * decrypted client-side before being sent here.
 */

import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { defineSecret } from 'firebase-functions/params';
import { AnthropicService, MODELS } from '../services/anthropicService';
import { getRefinementEditPrompt } from '../utils/prompts';

const anthropicKey = defineSecret('ANTHROPIC_KEY');

interface RefinementAIResponse {
  status: 'complete';
  questions: [];
  updatedFhirData: any;
  updatedBelroseFields: any;
}

export const refineRecord = onRequest(
  {
    secrets: [anthropicKey],
    cors: true,
    timeoutSeconds: 120,
  },
  async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      const { fhirData, belroseFields, userRequest } = req.body;

      if (!fhirData || !userRequest) {
        res.status(400).json({ error: 'fhirData and userRequest are required' });
        return;
      }

      const apiKey = anthropicKey.value();
      if (!apiKey) {
        res.status(500).json({ error: 'API key not configured' });
        return;
      }

      const anthropicService = new AnthropicService(apiKey);

      const prompt = getRefinementEditPrompt({
        fhirData,
        belroseFields,
        userRequest,
      });

      const responseText = await anthropicService.sendTextMessage(prompt, {
        model: MODELS.SONNET,
        maxTokens: 4000,
        temperature: 0.1,
      });

      const result = AnthropicService.parseJSONResponse<RefinementAIResponse>(responseText);

      if (result.status !== 'complete') {
        throw new Error('AI returned unexpected status');
      }

      res.json(result);
    } catch (error) {
      console.error('❌ refineRecord error:', error);
      res.status(500).json({
        error: 'Edit request failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);
