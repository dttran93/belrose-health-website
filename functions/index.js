const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const cors = require('cors')({origin: true});

//Define the secret for the Anthropic API key
const anthropicKey = defineSecret('ANTHROPIC_KEY');

exports.convertToFHIR = functions.https.onRequest({ secrets: [anthropicKey] }, (req, res) => {
  cors(req, res, async () => {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
      const { documentText, documentType = 'medical_record' } = req.body;

      // Validate input
      if (!documentText || typeof documentText !== 'string') {
        return res.status(400).json({ error: 'documentText is required and must be a string' });
      }

      // Get API key from Firebase config. Updated for environmental variable
      const ANTHROPIC_API_KEY = anthropicKey.value();
      
      if (!ANTHROPIC_API_KEY) {
        console.error('Anthropic API key not configured');
        return res.status(500).json({ error: 'API key not configured' });
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

      const data = await response.json();
      
      // Extract the JSON from AI response
      let fhirContent = data.content[0].text;
      
      // Sometimes the AI wraps JSON in markdown code blocks, so we need to extract it
      if (fhirContent.includes('```json')) {
        const jsonMatch = fhirContent.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          fhirContent = jsonMatch[1];
        }
      } else if (fhirContent.includes('```')) {
        const jsonMatch = fhirContent.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          fhirContent = jsonMatch[1];
        }
      }
      
      // Parse and validate the JSON
      const fhirJson = JSON.parse(fhirContent);
      
      // Basic validation that it's a FHIR Bundle
      if (!fhirJson.resourceType || fhirJson.resourceType !== 'Bundle') {
        throw new Error('Response is not a valid FHIR Bundle');
      }
      
      // Return the FHIR data
      res.json(fhirJson);

    } catch (error) {
      console.error('FHIR conversion error:', error);
      
      // Return appropriate error response
      if (error.message.includes('JSON')) {
        res.status(500).json({ error: 'Failed to parse FHIR response from AI' });
      } else if (error.message.includes('AI API')) {
        res.status(502).json({ error: 'External API error' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });
});

exports.detectMedicalRecord = functions.https.onRequest({ secrets: [anthropicKey] }, (req, res) => {
  cors(req, res, async () => {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
      const { documentText, fileName = '', fileType = '' } = req.body;

      // Validate input
      if (!documentText || typeof documentText !== 'string') {
        return res.status(400).json({ error: 'documentText is required and must be a string' });
      }

      // Get API key from Firebase config. Updated for environmental variable
      const ANTHROPIC_API_KEY = anthropicKey.value();
      
      if (!ANTHROPIC_API_KEY) {
        console.error('Anthropic API key not configured');
        return res.status(500).json({ error: 'API key not configured' });
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
          temperature: 0.1, // Low temperature for consistent classification
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

      const data = await response.json();
      
      // Extract the JSON from AI's response
      let detectionContent = data.content[0].text;
      
      // Sometimes the AI wraps JSON in markdown code blocks
      if (detectionContent.includes('```json')) {
        const jsonMatch = detectionContent.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          detectionContent = jsonMatch[1];
        }
      } else if (detectionContent.includes('```')) {
        const jsonMatch = detectionContent.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          detectionContent = jsonMatch[1];
        }
      }
      
      // Parse and validate the JSON
      const detectionResult = JSON.parse(detectionContent);
      
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
      
      // Return appropriate error response
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
  });
});

// NEW: AI Vision Analysis Function
exports.analyzeImageWithAI = functions.https.onRequest({ secrets: [anthropicKey] }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
      const { image, fileName = '', fileType = '', analysisType = 'full' } = req.body;

      // Validate input
      if (!image || !image.base64 || !image.mediaType) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      // Get API key from Firebase config. Updated for environmental variable
      const ANTHROPIC_API_KEY = anthropicKey.value();
      
      if (!ANTHROPIC_API_KEY) {
        console.error('Anthropic API key not configured');
        return res.status(500).json({ error: 'API key not configured' });
      }

      // Create different prompts based on analysis type
      let prompt = '';
      
      if (analysisType === 'detection') {
        prompt = `
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
      } else if (analysisType === 'extraction') {
        prompt = `
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
      } else { // 'full' analysis
        prompt = `
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

      const data = await response.json();
      
      // Extract the JSON from AI's response
      let analysisContent = data.content[0].text;
      
      // Clean up response (remove markdown formatting if present)
      if (analysisContent.includes('```json')) {
        const jsonMatch = analysisContent.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          analysisContent = jsonMatch[1];
        }
      } else if (analysisContent.includes('```')) {
        const jsonMatch = analysisContent.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          analysisContent = jsonMatch[1];
        }
      }
      
      // Parse the JSON response
      const analysisResult = JSON.parse(analysisContent);
      
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
      
      // Return appropriate error response
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
  });
});


// Optional: Add a health check endpoint
exports.health = functions.https.onRequest({ secrets: [anthropicKey] }, (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});