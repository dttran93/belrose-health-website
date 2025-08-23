// functions/src/index.ts

import * as functions from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import cors from 'cors';
import { Request, Response } from 'express';
import {
  FHIRConversionRequest,
  FHIRConversionResponse,
  MedicalDetectionRequest,
  MedicalDetectionResponse,
  ImageAnalysisRequest,
  ImageAnalysisResponse,
  FHIRProcessingRequest,
  FHIRProcessingResponse,
  FHIRAnalysis,
  HealthCheckResponse,
  CloudFunctionError,
  ClaudeResponse
} from './index.types';

// CORS middleware
const corsHandler = cors({ origin: true });

// Define the secret for the Anthropic API key
const anthropicKey = defineSecret('ANTHROPIC_KEY');

// ==================== FHIR CONVERSION FUNCTION ====================

export const convertToFHIR = functions.https.onRequest(
  { secrets: [anthropicKey] },
  (req: Request, res: Response): void => {
    corsHandler(req, res, async (): Promise<void> => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
      }

      try {
        const { documentText, documentType = 'medical_record' }: FHIRConversionRequest = req.body;

        // Validate input
        if (!documentText || typeof documentText !== 'string') {
          res.status(400).json({ error: 'documentText is required and must be a string' });
          return;
        }

        // Get API key from Firebase config
        const ANTHROPIC_API_KEY = anthropicKey.value();
        
        if (!ANTHROPIC_API_KEY) {
          console.error('Anthropic API key not configured');
          res.status(500).json({ error: 'API key not configured' });
          return;
        }

        const prompt = `
          You are a medical data specialist. Convert the following medical document into a valid FHIR (Fast Healthcare Interoperability Resources) R4 format JSON.

          Document Type: ${documentType}
          Document Content:
          ${documentText}

          Requirements:
          1. Create appropriate FHIR resources (Patient, Observation, Condition, MedicationStatement, etc.)
          2. Use proper FHIR resource structure and data types
          3. Include all relevant medical information from the document
          4. Generate realistic but anonymous identifiers
          5. Follow FHIR R4 specification
          6. Return only valid JSON, no additional text

          Return the result as a FHIR Bundle resource containing all relevant resources.
        `;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            temperature: 0.1,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ]
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Anthropic API error:', errorData);
          throw new Error(`AI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data: ClaudeResponse = await response.json();
        
        // Extract the JSON from AI response
        let fhirContent = data.content[0].text;
        
        // Clean up markdown formatting
        fhirContent = cleanMarkdownJson(fhirContent);
        
        // Parse and validate the JSON
        const fhirJson: FHIRConversionResponse = JSON.parse(fhirContent);
        
        // Basic validation that it's a FHIR Bundle
        if (!fhirJson.resourceType || fhirJson.resourceType !== 'Bundle') {
          throw new Error('Response is not a valid FHIR Bundle');
        }
        
        // Return the FHIR data
        res.json(fhirJson);

      } catch (error) {
        console.error('FHIR conversion error:', error);
        handleError(res, error, 'FHIR conversion');
      }
    });
  }
);

// ==================== MEDICAL DETECTION FUNCTION ====================

export const detectMedicalRecord = functions.https.onRequest(
  { secrets: [anthropicKey] },
  (req: Request, res: Response): void => {
    corsHandler(req, res, async (): Promise<void> => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
      }

      try {
        const { documentText, fileName = '', fileType = '' }: MedicalDetectionRequest = req.body;

        // Validate input
        if (!documentText || typeof documentText !== 'string') {
          res.status(400).json({ error: 'documentText is required and must be a string' });
          return;
        }

        const ANTHROPIC_API_KEY = anthropicKey.value();
        
        if (!ANTHROPIC_API_KEY) {
          console.error('Anthropic API key not configured');
          res.status(500).json({ error: 'API key not configured' });
          return;
        }

        const prompt = `
          You are a medical document classification expert. Analyze the following document text and determine if it is a medical record or medical-related document.

          Document Text:
          ${documentText}

          Additional Context:
          - File Name: ${fileName}
          - File Type: ${fileType}

          Please analyze this document and provide your assessment in JSON format with the following structure:
          {
            "isMedical": boolean,
            "confidence": number between 0 and 1,
            "documentType": string (options: "medical_record", "lab_results", "radiology_report", "prescription", "discharge_summary", "consultation_notes", "medical_imaging", "insurance_document", "business_document", "invoice", "receipt", "personal_document", "unknown"),
            "reasoning": string explaining your decision,
            "medicalSpecialty": string or null (if medical, what specialty: "cardiology", "neurology", "general", etc.),
            "suggestion": string with recommendation
          }

          Classification Guidelines:
          1. Medical records contain patient information, diagnoses, treatments, medications, or clinical observations
          2. Business documents like invoices, receipts, hotel bills are NOT medical even if from medical facilities
          3. Look for medical terminology, patient identifiers, clinical measurements, diagnostic codes
          4. Consider document structure typical of medical records
          5. Be conservative - if unsure, lean towards non-medical to avoid false positives

          Return ONLY the JSON response, no additional text.
        `;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1000,
            temperature: 0.1,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ]
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Anthropic API error:', errorData);
          throw new Error(`AI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data: ClaudeResponse = await response.json();
        
        // Extract and clean JSON
        let detectionContent = data.content[0].text;
        detectionContent = cleanMarkdownJson(detectionContent);
        
        // Parse and validate the JSON
        const detectionResult: MedicalDetectionResponse = JSON.parse(detectionContent);
        
        // Validate the response structure
        if (typeof detectionResult.isMedical !== 'boolean' ||
            typeof detectionResult.confidence !== 'number' ||
            !detectionResult.documentType ||
            !detectionResult.reasoning) {
          throw new Error('Invalid response structure from AI');
        }

        // Ensure confidence is between 0 and 1
        detectionResult.confidence = Math.max(0, Math.min(1, detectionResult.confidence));
        
        // Add timestamp
        detectionResult.detectedAt = new Date().toISOString();
        
        // Return the detection result
        res.json(detectionResult);

      } catch (error) {
        console.error('Medical detection error:', error);
        handleMedicalDetectionError(res, error);
      }
    });
  }
);

// ==================== IMAGE ANALYSIS FUNCTION ====================

export const analyzeImageWithAI = functions.https.onRequest(
  { secrets: [anthropicKey] },
  (req: Request, res: Response): void => {
    corsHandler(req, res, async (): Promise<void> => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
      }

      try {
        const { image, fileName = '', fileType = '', analysisType = 'full' }: ImageAnalysisRequest = req.body;

        // Validate input
        if (!image || !image.base64 || !image.mediaType) {
          res.status(400).json({ error: 'Image data is required' });
          return;
        }

        const ANTHROPIC_API_KEY = anthropicKey.value();
        
        if (!ANTHROPIC_API_KEY) {
          console.error('Anthropic API key not configured');
          res.status(500).json({ error: 'API key not configured' });
          return;
        }

        // Create different prompts based on analysis type
        const prompt = getImageAnalysisPrompt(analysisType);

        // Call AI Vision API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2000,
            temperature: 0.1,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: image.mediaType,
                      data: image.base64
                    }
                  },
                  {
                    type: 'text',
                    text: prompt
                  }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('AI Vision API error:', errorData);
          throw new Error(`AI Vision API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data: ClaudeResponse = await response.json();
        
        // Extract and clean JSON
        let analysisContent = data.content[0].text;
        analysisContent = cleanMarkdownJson(analysisContent);
        
        // Parse the JSON response
        const analysisResult: ImageAnalysisResponse = JSON.parse(analysisContent);
        
        // Add metadata
        analysisResult.analyzedAt = new Date().toISOString();
        analysisResult.fileName = fileName;
        analysisResult.fileType = fileType;
        analysisResult.analysisType = analysisType;
        
        // Validate confidence score
        if (analysisResult.confidence !== undefined) {
          analysisResult.confidence = Math.max(0, Math.min(1, analysisResult.confidence));
        }
        
        // Return the analysis result
        res.json(analysisResult);

      } catch (error) {
        console.error('Image analysis error:', error);
        handleImageAnalysisError(res, error);
      }
    });
  }
);

// ==================== NEW: FHIR PROCESSING FUNCTION ====================

export const processFHIRWithAI = functions.https.onRequest(
  { secrets: [anthropicKey] },
  (req: Request, res: Response): void => {
    corsHandler(req, res, async (): Promise<void> => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
      }

      try {
        console.log('🏥 FHIR processing request received');
        
        const { fhirData, fileName, analysis }: FHIRProcessingRequest = req.body;
        
        // Validate input
        if (!fhirData) {
          res.status(400).json({ error: 'fhirData is required' });
          return;
        }

        const ANTHROPIC_API_KEY = anthropicKey.value();
        
        if (!ANTHROPIC_API_KEY) {
          console.error('Anthropic API key not configured');
          res.status(500).json({ error: 'API key not configured' });
          return;
        }

        // Process FHIR data with Claude
        const result = await processFHIRWithClaude(fhirData, fileName, analysis, ANTHROPIC_API_KEY);
        
        console.log('✅ FHIR processing completed successfully');
        res.status(200).json(result);

      } catch (error) {
        console.error('❌ FHIR processing error:', error);
        handleError(res, error, 'FHIR processing');
      }
    });
  }
);

// ==================== HEALTH CHECK FUNCTION ====================

export const health = functions.https.onRequest(
  { secrets: [anthropicKey] },
  (req: Request, res: Response): void => {
    const response: HealthCheckResponse = {
      status: 'OK',
      timestamp: new Date().toISOString()
    };
    res.json(response);
  }
);

// ==================== HELPER FUNCTIONS ====================

function cleanMarkdownJson(content: string): string {
  // Remove markdown code blocks
  if (content.includes('```json')) {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return jsonMatch[1];
    }
  } else if (content.includes('```')) {
    const jsonMatch = content.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return jsonMatch[1];
    }
  }
  return content;
}

function getImageAnalysisPrompt(analysisType: string): string {
  switch (analysisType) {
    case 'detection':
      return `
        Analyze this image to determine if it contains medical information or is a medical document.
        
        Look for:
        - Medical forms, lab reports, prescriptions, medical records
        - Medical charts, graphs, or diagnostic images
        - Medical terminology, patient information, clinical data
        - Healthcare provider information, medical facility branding
        
        Respond with JSON:
        {
          "isMedical": boolean,
          "confidence": number (0-1),
          "documentType": string,
          "reasoning": string,
          "suggestion": string
        }
      `;
    
    case 'extraction':
      return `
        Extract ALL text content from this image. Focus on accuracy and completeness.
        
        Instructions:
        - Read every visible text element
        - Maintain formatting when possible
        - Include headers, labels, values, and any handwritten text
        - Preserve numerical values and units exactly
        - If text is unclear, indicate with [unclear] notation
        
        Respond with JSON:
        {
          "extractedText": string,
          "imageQuality": string ("excellent", "good", "fair", "poor"),
          "readabilityScore": number (0-1)
        }
      `;
    
    default: // 'full' analysis
      return `
        Perform a comprehensive analysis of this medical image/document.
        
        Please analyze:
        1. Is this a medical document? What type?
        2. Extract all visible text content
        3. Identify any structured medical data
        4. Assess image quality and readability
        
        Respond with JSON:
        {
          "isMedical": boolean,
          "confidence": number (0-1),
          "documentType": string ("lab_results", "prescription", "medical_record", "radiology_report", "discharge_summary", "medical_imaging", "non_medical", etc.),
          "reasoning": string,
          "suggestion": string,
          "extractedText": string,
          "medicalSpecialty": string or null,
          "structuredData": {
            "patientName": string or null,
            "patientId": string or null,
            "date": string or null,
            "provider": string or null,
            "facility": string or null,
            "testResults": array or null,
            "medications": array or null,
            "diagnoses": array or null
          },
          "imageQuality": string ("excellent", "good", "fair", "poor"),
          "readabilityScore": number (0-1)
        }
      `;
  }
}

async function processFHIRWithClaude(
  fhirData: any,
  fileName?: string,
  analysis?: FHIRAnalysis,
  apiKey?: string
): Promise<FHIRProcessingResponse> {
  console.log('🤖 Processing FHIR data with Claude...');
  
  const prompt = buildFHIRPrompt(fhirData, fileName, analysis);
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Claude API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data: ClaudeResponse = await response.json();
    const content = data.content[0]?.text || '';
    
    console.log('🎯 Claude FHIR response received');

    // Extract JSON from Claude's response
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.warn('⚠️ No JSON found in Claude response, using fallback');
      return createFallbackFHIRResponse(fileName, analysis);
    }

    const result = JSON.parse(jsonMatch[0]) as Partial<FHIRProcessingResponse>;
    return validateAndCleanFHIRResult(result, fileName);
    
  } catch (error) {
    console.error('Claude FHIR processing error:', error);
    return createFallbackFHIRResponse(fileName, analysis);
  }
}

function buildFHIRPrompt(fhirData: any, fileName?: string, analysis?: FHIRAnalysis): string {
  const today = new Date().toISOString().split('T')[0];
  const resourceTypes = analysis?.resourceTypes || [];
  const extractedDates = analysis?.extractedDates || [];
  
  return `Analyze this FHIR healthcare data and extract 6 key fields in JSON format.

Required JSON response:
{
  "visitType": "Visit type (e.g., 'Lab Results', 'Follow-up Appointment')",
  "title": "Short title under 100-150 characters succinctly describing the record",
  "summary": "Summary of record in approximately 250-500 characters, include as much information as possible that a future reader of the record would find useful",
  "completedDate": "Date in YYYY-MM-DD format",
  "provider": "Doctor/provider name",
  "institution": "Hospital/clinic name"
  "patient" : "Patient name"
}

Rules:
- Use today's date if no date found: ${today}
- Use "Unknown Healthcare Provider" if no provider found
- Use "Unknown Medical Center" if no institution found
- Use "Unknown Patient" if no patient found
- Respond with ONLY the JSON object

Context:
File: ${fileName || 'Unknown'}
Resources: ${resourceTypes.join(', ')}
Available dates: ${extractedDates.slice(0, 3).join(', ')}

FHIR Data:
${JSON.stringify(fhirData, null, 2).substring(0, 3000)}${JSON.stringify(fhirData).length > 3000 ? '...(truncated)' : ''}`;
}

function validateAndCleanFHIRResult(
  result: Partial<FHIRProcessingResponse>,
  fileName?: string
): FHIRProcessingResponse {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    visitType: result.visitType || 'Medical Record',
    title: truncateString(result.title || fileName || 'Health Record', 100),
    summary: truncateString(result.summary || 'Medical record processed.', 250),
    completedDate: validateDate(result.completedDate) || today,
    provider: truncateString(result.provider || 'Healthcare Provider', 100),
    institution: truncateString(result.institution || 'Medical Center', 100),
    patient: truncateString(result.patient || 'Patient', 100),
  };
}

function createFallbackFHIRResponse(
  fileName?: string,
  analysis?: FHIRAnalysis
): FHIRProcessingResponse {
  console.log('🛡️ Creating fallback FHIR response');
  
  const resourceTypes = analysis?.resourceTypes || [];
  let visitType = 'Medical Record';
  
  if (resourceTypes.includes('DiagnosticReport')) {
    visitType = 'Diagnostic Report';
  } else if (resourceTypes.includes('Observation')) {
    visitType = 'Lab Results';
  } else if (resourceTypes.includes('Encounter')) {
    visitType = 'Clinical Visit';
  }
  
  return {
    visitType,
    title: fileName || 'Health Record',
    summary: 'Medical record processed successfully.',
    completedDate: new Date().toISOString().split('T')[0],
    provider: 'Healthcare Provider',
    institution: 'Medical Center',
    patient: 'Patient'
  };
}

function validateDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? dateStr : null;
}

function truncateString(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

// ==================== ERROR HANDLING FUNCTIONS ====================

function handleError(res: Response, error: any, context: string): void {
  if (error.message.includes('JSON')) {
    res.status(500).json({ error: `Failed to parse ${context} response from AI` });
  } else if (error.message.includes('AI API') || error.message.includes('Claude')) {
    res.status(502).json({ error: 'External API error' });
  } else {
    res.status(500).json({ error: 'Internal server error' });
  }
}

function handleMedicalDetectionError(res: Response, error: any): void {
  if (error.message.includes('JSON')) {
    res.status(500).json({ 
      error: 'Failed to parse AI response',
      isMedical: false,
      confidence: 0,
      documentType: 'unknown',
      reasoning: 'AI service error - unable to analyze document',
      suggestion: 'Please try again or contact support'
    });
  } else if (error.message.includes('Claude API')) {
    res.status(502).json({ 
      error: 'External AI service error',
      isMedical: false,
      confidence: 0,
      documentType: 'unknown',
      reasoning: 'AI service temporarily unavailable',
      suggestion: 'Please try again later'
    });
  } else {
    res.status(500).json({ 
      error: 'Internal server error',
      isMedical: false,
      confidence: 0,
      documentType: 'unknown',
      reasoning: 'Server error during analysis',
      suggestion: 'Please try again or contact support'
    });
  }
}

function handleImageAnalysisError(res: Response, error: any): void {
  if (error.message.includes('JSON')) {
    res.status(500).json({ 
      error: 'Failed to parse AI response',
      isMedical: false,
      confidence: 0,
      extractedText: '',
      suggestion: 'AI analysis failed - unable to process image'
    });
  } else if (error.message.includes('Claude')) {
    res.status(502).json({ 
      error: 'AI vision service error',
      isMedical: false,
      confidence: 0,
      extractedText: '',
      suggestion: 'Vision AI service temporarily unavailable'
    });
  } else {
    res.status(500).json({ 
      error: 'Internal server error',
      isMedical: false,
      confidence: 0,
      extractedText: '',
      suggestion: 'Server error during image analysis'
    });
  }
}