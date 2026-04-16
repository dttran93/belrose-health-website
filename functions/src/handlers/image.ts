// functions/src/handlers/image.ts

import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { defineSecret } from 'firebase-functions/params';
import { AnthropicService, MODELS } from '../services/anthropicService';
import { getImageAnalysisPrompt } from '../utils/prompts';
import { ImageAnalysisRequest, ImageAnalysisResponse } from '@belrose/shared';

// Define the secret
const anthropicKey = defineSecret('ANTHROPIC_KEY');

/**
 * Image Analysis Function
 * Analyzes medical images and documents using AI vision
 */
export const analyzeImageWithAI = onRequest(
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
      const { image, fileName = '', fileType = '' } = req.body as ImageAnalysisRequest;

      if (!image || !image.base64 || !image.mediaType) {
        res.status(400).json({ error: 'Image data is required' });
        return;
      }

      // Get API key
      const apiKey = anthropicKey.value();
      if (!apiKey) {
        console.error('❌ Anthropic API key not configured');
        res.status(500).json({ error: 'API key not configured' });
        return;
      }

      console.log('🖼️ Analyzing image...', {
        fileName,
        fileType,
        imageSize: image.base64.length,
      });

      // Create Anthropic service
      const anthropicService = new AnthropicService(apiKey);

      // Get the appropriate prompt for this analysis type
      const prompt = getImageAnalysisPrompt();

      // Send image for analysis
      const responseText = await anthropicService.sendImageMessage(
        image.base64,
        image.mediaType,
        prompt,
        {
          model: MODELS.SONNET,
          maxTokens: 2000,
          temperature: 0.1,
        }
      );

      // Parse the response
      const analysisResult: ImageAnalysisResponse =
        AnthropicService.parseJSONResponse(responseText);

      res.json(analysisResult);
    } catch (error) {
      console.error('❌ Image analysis error:', error);
      handleImageAnalysisError(res, error);
    }
  }
);

/**
 * Handle image analysis errors with appropriate fallback response
 */
function handleImageAnalysisError(res: Response, error: unknown): void {
  console.error('❌ Image analysis failed:', error);

  const message = error instanceof Error ? error.message : 'Failed to process image';

  res.status(500).json({ error: message });
}
