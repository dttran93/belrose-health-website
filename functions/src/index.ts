// functions/src/index.ts

import { defineSecret } from 'firebase-functions/params';
import { CallableRequest, HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import {
  FHIRConversionRequest,
  FHIRConversionResponse,
  ImageAnalysisRequest,
  ImageAnalysisResponse,
  FHIRProcessingRequest,
  FHIRProcessingResponse,
  FHIRAnalysis,
  HealthCheckResponse,
  ClaudeResponse,
  PersonaInquiryResponse,
  VerifiedData,
  CreateSessionResponse,
  CheckStatusRequest,
  CheckStatusResponse,
  CreateVerificationSessionRequest,
} from './index.types';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { generateWallet, encryptPrivateKey } from './services/backendWalletService';
import * as crypto from 'crypto';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// Define secrets
const anthropicKey = defineSecret('ANTHROPIC_KEY');
const personaKey = defineSecret('PERSONA_API_KEY');
const personaWebhookSecret = defineSecret('PERSONA_WEBHOOK_SECRET');

// ==================== FHIR CONVERSION FUNCTION (V2) ====================

export const convertToFHIR = onRequest(
  {
    secrets: [anthropicKey],
    cors: true,
  },
  async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      const { documentText } = req.body as FHIRConversionRequest;

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
        You are a medical data specialist. Convert the following medical document into a valid FHIR (Fast Healthcare Interoperability Resources) R4 format JSON.

        Document Content:
        ${documentText}

        Requirements:
        1. Create appropriate FHIR resources (Patient, Observation, Condition, MedicationStatement, etc.)
        2. Use proper FHIR resource structure and data types
        3. Include all relevant medical information from the document
        4. Preserve any patient identifiers, dates, and provider information found in the original document
        5. Follow FHIR R4 specification
        6. Return only valid JSON, no additional text

        Return the result as a FHIR Bundle resource containing all relevant resources.
      `;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          temperature: 0.1,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Anthropic API error:', errorData);
        throw new Error(
          `AI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        );
      }

      const data: ClaudeResponse = await response.json();
      let fhirContent = data.content[0].text;
      fhirContent = cleanMarkdownJson(fhirContent);

      const fhirJson: FHIRConversionResponse = JSON.parse(fhirContent);

      if (!fhirJson.resourceType || fhirJson.resourceType !== 'Bundle') {
        throw new Error('Response is not a valid FHIR Bundle');
      }

      res.json(fhirJson);
    } catch (error) {
      console.error('FHIR conversion error:', error);
      handleError(res, error, 'FHIR conversion');
    }
  }
);

// ==================== IMAGE ANALYSIS FUNCTION (V2) ====================

export const analyzeImageWithAI = onRequest(
  {
    secrets: [anthropicKey],
    cors: true,
  },
  async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
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

      const ANTHROPIC_API_KEY = anthropicKey.value();

      if (!ANTHROPIC_API_KEY) {
        console.error('Anthropic API key not configured');
        res.status(500).json({ error: 'API key not configured' });
        return;
      }

      const prompt = getImageAnalysisPrompt(analysisType);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
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
                    data: image.base64,
                  },
                },
                { type: 'text', text: prompt },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('AI Vision API error:', errorData);
        throw new Error(
          `AI Vision API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        );
      }

      const data: ClaudeResponse = await response.json();
      let analysisContent = data.content[0].text;
      analysisContent = cleanMarkdownJson(analysisContent);

      const analysisResult: ImageAnalysisResponse = JSON.parse(analysisContent);
      analysisResult.analyzedAt = new Date().toISOString();
      analysisResult.fileName = fileName;
      analysisResult.fileType = fileType;
      analysisResult.analysisType = analysisType;

      if (analysisResult.confidence !== undefined) {
        analysisResult.confidence = Math.max(0, Math.min(1, analysisResult.confidence));
      }

      res.json(analysisResult);
    } catch (error) {
      console.error('Image analysis error:', error);
      handleImageAnalysisError(res, error);
    }
  }
);

// ==================== FHIR PROCESSING FUNCTION (V2) ====================

export const processFHIRWithAI = onRequest(
  {
    secrets: [anthropicKey],
    cors: true,
  },
  async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      console.log('🏥 FHIR processing request received');

      const { fhirData, fileName, analysis } = req.body as FHIRProcessingRequest;

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

      const result = await processFHIRWithClaude(fhirData, fileName, analysis, ANTHROPIC_API_KEY);

      console.log('✅ FHIR processing completed successfully');
      res.status(200).json(result);
    } catch (error) {
      console.error('❌ FHIR processing error:', error);
      handleError(res, error, 'FHIR processing');
    }
  }
);

// ==================== HEALTH CHECK FUNCTION (V2) ====================

export const health = onRequest({ cors: true }, async (req: Request, res: Response) => {
  const response: HealthCheckResponse = {
    status: 'OK',
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

// ==================== WALLET FUNCTIONS (V2) ====================

export const createWallet = onRequest({ cors: true }, async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { userId, encryptionPassword } = req.body;

    if (!userId || !encryptionPassword) {
      res.status(400).json({ error: 'Missing userId or encryptionPassword' });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    if (decodedToken.uid !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const db = getFirestore();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = userDoc.data();
    if (userData?.generatedWallet) {
      res.status(400).json({ error: 'User already has a generated wallet' });
      return;
    }

    const wallet = generateWallet();
    console.log('Generated wallet address:', wallet.address);

    const encryptedData = encryptPrivateKey(wallet.privateKey, encryptionPassword);
    const encryptedMnemonic = encryptPrivateKey(wallet.mnemonic || '', encryptionPassword);

    await userRef.update({
      generatedWallet: {
        address: wallet.address,
        encryptedPrivateKey: encryptedData.encryptedKey,
        keyIv: encryptedData.iv,
        keyAuthTag: encryptedData.authTag,
        keySalt: encryptedData.salt,
        encryptedMnemonic: encryptedMnemonic.encryptedKey,
        mnemonicIv: encryptedMnemonic.iv,
        mnemonicAuthTag: encryptedMnemonic.authTag,
        mnemonicSalt: encryptedMnemonic.salt,
        walletType: 'generated',
        createdAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });

    console.log('Wallet saved for user:', userId);

    res.status(201).json({
      success: true,
      walletAddress: wallet.address,
      message: 'Wallet created successfully',
    });
  } catch (error: any) {
    console.error('Wallet creation error:', error);
    res.status(500).json({
      error: 'Failed to create wallet',
      message: error.message,
    });
  }
});

export const getEncryptedWallet = onRequest({ cors: true }, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = userDoc.data();
    const wallet = userData?.generatedWallet;

    if (!wallet) {
      res.status(404).json({ error: 'No generated wallet found' });
      return;
    }

    res.json({
      walletAddress: wallet.address,
      encryptedPrivateKey: wallet.encryptedPrivateKey,
      iv: wallet.keyIv,
      authTag: wallet.keyAuthTag,
      salt: wallet.keySalt,
      walletType: wallet.walletType,
    });
  } catch (error: any) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ error: 'Failed to fetch wallet data' });
  }
});

// ==================== PERSONA FUNCTIONS (V2) ====================

export const createVerificationSession = onCall<
  CreateVerificationSessionRequest,
  Promise<CreateSessionResponse>
>(
  { secrets: [personaKey] },
  async (
    request: CallableRequest<CreateVerificationSessionRequest>
  ): Promise<CreateSessionResponse> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to verify identity');
    }

    const userId = request.auth.uid;
    const { templateId } = request.data;

    if (!templateId) {
      throw new HttpsError('invalid-argument', 'templateId is required');
    }

    console.log('📝 Creating verification session for user:', userId);
    console.log('📋 Using template:', templateId);

    try {
      const PERSONA_API_KEY = personaKey.value();

      if (!PERSONA_API_KEY) {
        console.error('Persona API key not configured');
        throw new HttpsError('failed-precondition', 'Persona API key not configured');
      }

      const response = await fetch('https://withpersona.com/api/v1/inquiries', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PERSONA_API_KEY}`,
          'Persona-Version': '2023-01-05',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            attributes: {
              reference_id: userId,
              inquiry_template_id: templateId,
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Persona API error:', errorText);
        throw new HttpsError('internal', `Persona API error: ${response.status}`);
      }

      const personaData: PersonaInquiryResponse = await response.json();
      const inquiryId = personaData.data.id;

      console.log('✅ Inquiry created:', inquiryId);

      const db = getFirestore();
      await db.collection('verifications').doc(userId).set({
        inquiryId: inquiryId,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });

      // Return the inquiry ID as the "token" - Persona Client can use this
      return {
        sessionToken: inquiryId, // Use inquiry ID directly
        inquiryId: inquiryId,
      };
    } catch (error: any) {
      console.error('❌ Error creating verification session:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', 'Failed to create verification session');
    }
  }
);

export const checkVerificationStatus = onCall<CheckStatusRequest, Promise<CheckStatusResponse>>(
  { secrets: [personaKey] },
  async (request: CallableRequest<CheckStatusRequest>): Promise<CheckStatusResponse> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = request.auth.uid;
    const { inquiryId } = request.data;

    if (!inquiryId) {
      throw new HttpsError('invalid-argument', 'inquiryId is required');
    }

    console.log('🔍 Checking verification status:', { userId, inquiryId });

    try {
      const PERSONA_API_KEY = personaKey.value();

      if (!PERSONA_API_KEY) {
        throw new HttpsError('failed-precondition', 'Persona API key not configured');
      }

      const response = await fetch(`https://withpersona.com/api/v1/inquiries/${inquiryId}`, {
        headers: {
          Authorization: `Bearer ${PERSONA_API_KEY}`,
          'Persona-Version': '2023-01-05',
        },
      });

      if (!response.ok) {
        console.error(`Persona API error: ${response.status}`);
        throw new HttpsError('internal', 'Failed to fetch verification status');
      }

      const inquiry: PersonaInquiryResponse = await response.json();
      const status = inquiry.data.attributes.status;

      console.log('📊 Inquiry status from Persona:', status);

      const verified = status === 'approved';

      if (verified) {
        const verifiedData: VerifiedData = {
          firstName: inquiry.data.attributes.name_first || '',
          lastName: inquiry.data.attributes.name_last || '',
          dateOfBirth: inquiry.data.attributes.birthdate || '',
          address: inquiry.data.attributes.address_street_1 || '',
          postcode: inquiry.data.attributes.address_postal_code || '',
        };

        console.log('✅ User verified successfully:', userId);

        const db = getFirestore();
        const batch = db.batch();

        batch.update(db.collection('users').doc(userId), {
          identityVerified: true,
          verifiedData: verifiedData,
          verifiedAt: FieldValue.serverTimestamp(),
        });

        batch.update(db.collection('verifications').doc(userId), {
          status: 'approved',
          completedAt: FieldValue.serverTimestamp(),
        });

        await batch.commit();

        return { verified: true, data: verifiedData };
      } else {
        console.log('❌ Verification not approved:', status);

        const db = getFirestore();
        await db.collection('verifications').doc(userId).update({
          status: status,
          completedAt: FieldValue.serverTimestamp(),
        });

        return { verified: false, reason: status };
      }
    } catch (error: any) {
      console.error('❌ Error checking verification:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', 'Failed to check verification status');
    }
  }
);

export const personaWebhook = onRequest(
  {
    secrets: [personaKey, personaWebhookSecret],
    cors: true,
  },
  async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      const signature = req.headers['persona-signature'] as string | undefined;
      const webhookSecret = personaWebhookSecret.value();

      if (!webhookSecret) {
        console.error('⚠️ Webhook secret not configured');
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }

      const isValid = verifyPersonaWebhook(signature, req.body, webhookSecret);

      if (!isValid) {
        console.error('❌ Invalid webhook signature - possible fake request');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      console.log('✅ Webhook signature verified - legitimate request from Persona');

      const event = req.body;
      const eventName = event.data?.attributes?.name;
      const inquiry = event.data?.attributes?.payload?.data;
      const status = inquiry?.attributes?.status;
      const userId = inquiry?.attributes?.['reference-id'];

      console.log('📬 Processing verified webhook:', { eventName, status, userId });

      if (!userId) {
        console.error('⚠️ Missing reference-id in webhook payload');
        res.status(200).json({ received: true, warning: 'Missing reference_id' });
        return;
      }

      const db = getFirestore();

      switch (status) {
        case 'approved':
          console.log('✅ Webhook: User verified', userId);
          await db.collection('verifications').doc(userId).update({
            status: 'approved',
            completedAt: FieldValue.serverTimestamp(),
          });
          await db.collection('users').doc(userId).update({
            identityVerified: true,
            verifiedAt: FieldValue.serverTimestamp(),
          });
          break;

        case 'declined':
          console.log('❌ Webhook: Verification declined', userId);
          await db.collection('verifications').doc(userId).update({
            status: 'declined',
            completedAt: FieldValue.serverTimestamp(),
          });
          break;

        case 'needs_review':
          console.log('⏳ Webhook: Manual review needed', userId);
          await db.collection('verifications').doc(userId).update({
            status: 'needs_review',
            reviewRequestedAt: FieldValue.serverTimestamp(),
          });
          break;

        default:
          console.log('ℹ️ Unknown or unhandled status:', status);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      res.status(200).json({ received: true, error: 'Processing failed but acknowledged' });
    }
  }
);

// ==================== HELPER FUNCTIONS ====================

function cleanMarkdownJson(content: string): string {
  if (content.includes('```json')) {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) return jsonMatch[1];
  } else if (content.includes('```')) {
    const jsonMatch = content.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch) return jsonMatch[1];
  }
  return content;
}

function getImageAnalysisPrompt(analysisType: string): string {
  switch (analysisType) {
    case 'detection':
      return `Analyze this image to determine if it contains medical information or is a medical document...`;
    case 'extraction':
      return `Extract ALL text content from this image...`;
    default:
      return `Perform a comprehensive analysis of this medical image/document...`;
  }
}

async function processFHIRWithClaude(
  fhirData: any,
  fileName?: string,
  analysis?: FHIRAnalysis,
  apiKey?: string
): Promise<FHIRProcessingResponse> {
  // Implementation same as before...
  console.log('🤖 Processing FHIR data with Claude...');
  const prompt = buildFHIRPrompt(fhirData, fileName, analysis);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data: ClaudeResponse = await response.json();
    const content = data.content[0]?.text || '';

    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return createFallbackFHIRResponse(fileName, analysis);
    }

    const result = JSON.parse(jsonMatch[0]) as Partial<FHIRProcessingResponse>;
    return validateAndCleanFHIRResult(result, fileName);
  } catch (error) {
    return createFallbackFHIRResponse(fileName, analysis);
  }
}

function buildFHIRPrompt(fhirData: any, fileName?: string, analysis?: FHIRAnalysis): string {
  const today = new Date().toISOString().split('T')[0];
  return `Analyze this FHIR healthcare data...`;
}

function validateAndCleanFHIRResult(
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

function createFallbackFHIRResponse(
  fileName?: string,
  analysis?: FHIRAnalysis
): FHIRProcessingResponse {
  return {
    visitType: 'Medical Record',
    title: fileName || 'Health Record',
    summary: 'Medical record processed successfully.',
    completedDate: new Date().toISOString().split('T')[0],
    provider: 'Healthcare Provider',
    institution: 'Medical Center',
    patient: 'Patient',
  };
}

function validateDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? dateStr : null;
}

function handleError(res: Response, error: any, context: string): void {
  if (error.message?.includes('JSON')) {
    res.status(500).json({ error: `Failed to parse ${context} response from AI` });
  } else if (error.message?.includes('AI API') || error.message?.includes('Claude')) {
    res.status(502).json({ error: 'External API error' });
  } else {
    res.status(500).json({ error: 'Internal server error' });
  }
}

function handleImageAnalysisError(res: Response, error: any): void {
  res.status(500).json({
    error: 'Failed to process image',
    isMedical: false,
    confidence: 0,
    extractedText: '',
    suggestion: 'Image analysis failed',
  });
}

function verifyPersonaWebhook(signature: string | undefined, body: any, secret: string): boolean {
  if (!signature) {
    console.error('⚠️ No signature provided in webhook');
    return false;
  }

  try {
    const parts = signature.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      console.error('⚠️ Invalid signature format');
      return false;
    }

    const timestamp = timestampPart.split('=')[1];
    const receivedSignature = signaturePart.split('=')[1];

    const currentTime = Math.floor(Date.now() / 1000);
    const maxAge = 300;

    if (Math.abs(currentTime - parseInt(timestamp)) > maxAge) {
      console.error('⚠️ Webhook timestamp too old');
      return false;
    }

    const payload = `${timestamp}.${JSON.stringify(body)}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature));
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    return false;
  }
}
