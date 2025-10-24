// functions/src/handlers/image.ts

import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { defineSecret } from 'firebase-functions/params';
import { AnthropicService, MODELS } from '../services/anthropicService';
import { getImageAnalysisPrompt } from '../utils/prompts';
import type { ImageAnalysisRequest, ImageAnalysisResponse } from '../index.types';

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
      const {
        image,
        fileName = '',
        fileType = '',
        analysisType = 'full',
      } = req.body as ImageAnalysisRequest;

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
        analysisType,
        imageSize: image.base64.length,
      });

      // Create Anthropic service
      const anthropicService = new AnthropicService(apiKey);

      // Get the appropriate prompt for this analysis type
      const prompt = getImageAnalysisPrompt(analysisType);

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

      // Enrich the result with metadata
      enrichAnalysisResult(analysisResult, fileName, fileType, analysisType);

      console.log('✅ Image analysis successful', {
        isMedical: analysisResult.isMedical,
        confidence: analysisResult.confidence,
      });

      res.json(analysisResult);
    } catch (error) {
      console.error('❌ Image analysis error:', error);
      handleImageAnalysisError(res, error);
    }
  }
);

/**
 * Enrich analysis result with additional metadata
 */
function enrichAnalysisResult(
  result: ImageAnalysisResponse,
  fileName: string,
  fileType: string,
  analysisType: string
): void {
  // Add timestamp
  result.analyzedAt = new Date().toISOString();

  // Add file info
  result.fileName = fileName;
  result.fileType = fileType;
  result.analysisType = analysisType;

  // Ensure confidence is between 0 and 1
  if (result.confidence !== undefined) {
    result.confidence = Math.max(0, Math.min(1, result.confidence));
  }

  // Provide default values if missing
  if (result.isMedical === undefined) {
    result.isMedical = false;
  }

  if (!result.suggestion) {
    result.suggestion = result.isMedical
      ? 'Medical content detected in image'
      : 'No medical content detected';
  }
}

/**
 * Handle image analysis errors with appropriate fallback response
 */
function handleImageAnalysisError(res: Response, error: any): void {
  console.error('❌ Image analysis failed:', error);

  // Determine error type and response
  let statusCode = 500;
  let errorMessage = 'Failed to process image';

  if (error.message?.includes('JSON') || error.message?.includes('parse')) {
    errorMessage = 'Failed to parse AI response';
  } else if (error.message?.includes('Anthropic') || error.name === 'AnthropicAPIError') {
    statusCode = 502;
    errorMessage = 'External AI service error';
  }

  // Return error response with safe fallback values
  res.status(statusCode).json({
    error: errorMessage,
    isMedical: false,
    confidence: 0,
    extractedText: '',
    suggestion: 'Image analysis failed - please try again',
    analyzedAt: new Date().toISOString(),
  } as ImageAnalysisResponse);
}
