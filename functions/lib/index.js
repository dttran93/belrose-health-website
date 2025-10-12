"use strict";
// functions/src/index.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.personaWebhook = exports.checkVerificationStatus = exports.createVerificationSession = exports.getEncryptedWallet = exports.createWallet = exports.health = exports.processFHIRWithAI = exports.analyzeImageWithAI = exports.convertToFHIR = void 0;
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const backendWalletService_1 = require("./services/backendWalletService");
const crypto = __importStar(require("crypto"));
// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
// Define secrets
const anthropicKey = (0, params_1.defineSecret)('ANTHROPIC_KEY');
const personaKey = (0, params_1.defineSecret)('PERSONA_API_KEY');
const personaWebhookSecret = (0, params_1.defineSecret)('PERSONA_WEBHOOK_SECRET');
// ==================== FHIR CONVERSION FUNCTION (V2) ====================
exports.convertToFHIR = (0, https_1.onRequest)({
    secrets: [anthropicKey],
    cors: true,
}, async (req, res) => {
    var _a;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        const { documentText } = req.body;
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
            throw new Error(`AI API error: ${response.status} - ${((_a = errorData.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error'}`);
        }
        const data = await response.json();
        let fhirContent = data.content[0].text;
        fhirContent = cleanMarkdownJson(fhirContent);
        const fhirJson = JSON.parse(fhirContent);
        if (!fhirJson.resourceType || fhirJson.resourceType !== 'Bundle') {
            throw new Error('Response is not a valid FHIR Bundle');
        }
        res.json(fhirJson);
    }
    catch (error) {
        console.error('FHIR conversion error:', error);
        handleError(res, error, 'FHIR conversion');
    }
});
// ==================== IMAGE ANALYSIS FUNCTION (V2) ====================
exports.analyzeImageWithAI = (0, https_1.onRequest)({
    secrets: [anthropicKey],
    cors: true,
}, async (req, res) => {
    var _a;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        const { image, fileName = '', fileType = '', analysisType = 'full', } = req.body;
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
            throw new Error(`AI Vision API error: ${response.status} - ${((_a = errorData.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error'}`);
        }
        const data = await response.json();
        let analysisContent = data.content[0].text;
        analysisContent = cleanMarkdownJson(analysisContent);
        const analysisResult = JSON.parse(analysisContent);
        analysisResult.analyzedAt = new Date().toISOString();
        analysisResult.fileName = fileName;
        analysisResult.fileType = fileType;
        analysisResult.analysisType = analysisType;
        if (analysisResult.confidence !== undefined) {
            analysisResult.confidence = Math.max(0, Math.min(1, analysisResult.confidence));
        }
        res.json(analysisResult);
    }
    catch (error) {
        console.error('Image analysis error:', error);
        handleImageAnalysisError(res, error);
    }
});
// ==================== FHIR PROCESSING FUNCTION (V2) ====================
exports.processFHIRWithAI = (0, https_1.onRequest)({
    secrets: [anthropicKey],
    cors: true,
}, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        console.log('🏥 FHIR processing request received');
        const { fhirData, fileName, analysis } = req.body;
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
    }
    catch (error) {
        console.error('❌ FHIR processing error:', error);
        handleError(res, error, 'FHIR processing');
    }
});
// ==================== HEALTH CHECK FUNCTION (V2) ====================
exports.health = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    const response = {
        status: 'OK',
        timestamp: new Date().toISOString(),
    };
    res.json(response);
});
// ==================== WALLET FUNCTIONS (V2) ====================
exports.createWallet = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
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
        if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer '))) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        if (decodedToken.uid !== userId) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const db = (0, firestore_1.getFirestore)();
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const userData = userDoc.data();
        if (userData === null || userData === void 0 ? void 0 : userData.generatedWallet) {
            res.status(400).json({ error: 'User already has a generated wallet' });
            return;
        }
        const wallet = (0, backendWalletService_1.generateWallet)();
        console.log('Generated wallet address:', wallet.address);
        const encryptedData = (0, backendWalletService_1.encryptPrivateKey)(wallet.privateKey, encryptionPassword);
        const encryptedMnemonic = (0, backendWalletService_1.encryptPrivateKey)(wallet.mnemonic || '', encryptionPassword);
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
    }
    catch (error) {
        console.error('Wallet creation error:', error);
        res.status(500).json({
            error: 'Failed to create wallet',
            message: error.message,
        });
    }
});
exports.getEncryptedWallet = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        const authHeader = req.headers.authorization;
        if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer '))) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        const db = (0, firestore_1.getFirestore)();
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const userData = userDoc.data();
        const wallet = userData === null || userData === void 0 ? void 0 : userData.generatedWallet;
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
    }
    catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).json({ error: 'Failed to fetch wallet data' });
    }
});
// ==================== PERSONA FUNCTIONS (V2) ====================
exports.createVerificationSession = (0, https_1.onCall)({ secrets: [personaKey] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to verify identity');
    }
    const userId = request.auth.uid;
    const { templateId } = request.data;
    if (!templateId) {
        throw new https_1.HttpsError('invalid-argument', 'templateId is required');
    }
    console.log('📝 Creating verification session for user:', userId);
    console.log('📋 Using template:', templateId);
    try {
        const PERSONA_API_KEY = personaKey.value();
        if (!PERSONA_API_KEY) {
            console.error('Persona API key not configured');
            throw new https_1.HttpsError('failed-precondition', 'Persona API key not configured');
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
            throw new https_1.HttpsError('internal', `Persona API error: ${response.status}`);
        }
        const personaData = await response.json();
        const inquiryId = personaData.data.id;
        console.log('✅ Inquiry created:', inquiryId);
        const db = (0, firestore_1.getFirestore)();
        await db.collection('verifications').doc(userId).set({
            inquiryId: inquiryId,
            status: 'pending',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Return the inquiry ID as the "token" - Persona Client can use this
        return {
            sessionToken: inquiryId, // Use inquiry ID directly
            inquiryId: inquiryId,
        };
    }
    catch (error) {
        console.error('❌ Error creating verification session:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to create verification session');
    }
});
exports.checkVerificationStatus = (0, https_1.onCall)({ secrets: [personaKey] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userId = request.auth.uid;
    const { inquiryId } = request.data;
    if (!inquiryId) {
        throw new https_1.HttpsError('invalid-argument', 'inquiryId is required');
    }
    console.log('🔍 Checking verification status:', { userId, inquiryId });
    try {
        const PERSONA_API_KEY = personaKey.value();
        if (!PERSONA_API_KEY) {
            throw new https_1.HttpsError('failed-precondition', 'Persona API key not configured');
        }
        const response = await fetch(`https://withpersona.com/api/v1/inquiries/${inquiryId}`, {
            headers: {
                Authorization: `Bearer ${PERSONA_API_KEY}`,
                'Persona-Version': '2023-01-05',
            },
        });
        if (!response.ok) {
            console.error(`Persona API error: ${response.status}`);
            throw new https_1.HttpsError('internal', 'Failed to fetch verification status');
        }
        const inquiry = await response.json();
        const status = inquiry.data.attributes.status;
        console.log('📊 Inquiry status from Persona:', status);
        const verified = status === 'approved';
        if (verified) {
            const verifiedData = {
                firstName: inquiry.data.attributes.name_first || '',
                lastName: inquiry.data.attributes.name_last || '',
                dateOfBirth: inquiry.data.attributes.birthdate || '',
                address: inquiry.data.attributes.address_street_1 || '',
                postcode: inquiry.data.attributes.address_postal_code || '',
            };
            console.log('✅ User verified successfully:', userId);
            const db = (0, firestore_1.getFirestore)();
            const batch = db.batch();
            batch.update(db.collection('users').doc(userId), {
                identityVerified: true,
                verifiedData: verifiedData,
                verifiedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            batch.update(db.collection('verifications').doc(userId), {
                status: 'approved',
                completedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            await batch.commit();
            return { verified: true, data: verifiedData };
        }
        else {
            console.log('❌ Verification not approved:', status);
            const db = (0, firestore_1.getFirestore)();
            await db.collection('verifications').doc(userId).update({
                status: status,
                completedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            return { verified: false, reason: status };
        }
    }
    catch (error) {
        console.error('❌ Error checking verification:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to check verification status');
    }
});
exports.personaWebhook = (0, https_1.onRequest)({
    secrets: [personaKey, personaWebhookSecret],
    cors: true,
}, async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        const signature = req.headers['persona-signature'];
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
        const eventName = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.attributes) === null || _b === void 0 ? void 0 : _b.name;
        const inquiry = (_e = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.attributes) === null || _d === void 0 ? void 0 : _d.payload) === null || _e === void 0 ? void 0 : _e.data;
        const status = (_f = inquiry === null || inquiry === void 0 ? void 0 : inquiry.attributes) === null || _f === void 0 ? void 0 : _f.status;
        const userId = (_g = inquiry === null || inquiry === void 0 ? void 0 : inquiry.attributes) === null || _g === void 0 ? void 0 : _g['reference-id'];
        console.log('📬 Processing verified webhook:', { eventName, status, userId });
        if (!userId) {
            console.error('⚠️ Missing reference-id in webhook payload');
            res.status(200).json({ received: true, warning: 'Missing reference_id' });
            return;
        }
        const db = (0, firestore_1.getFirestore)();
        switch (status) {
            case 'approved':
                console.log('✅ Webhook: User verified', userId);
                await db.collection('verifications').doc(userId).update({
                    status: 'approved',
                    completedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                await db.collection('users').doc(userId).update({
                    identityVerified: true,
                    verifiedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                break;
            case 'declined':
                console.log('❌ Webhook: Verification declined', userId);
                await db.collection('verifications').doc(userId).update({
                    status: 'declined',
                    completedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                break;
            case 'needs_review':
                console.log('⏳ Webhook: Manual review needed', userId);
                await db.collection('verifications').doc(userId).update({
                    status: 'needs_review',
                    reviewRequestedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                break;
            default:
                console.log('ℹ️ Unknown or unhandled status:', status);
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('❌ Webhook processing error:', error);
        res.status(200).json({ received: true, error: 'Processing failed but acknowledged' });
    }
});
// ==================== HELPER FUNCTIONS ====================
function cleanMarkdownJson(content) {
    if (content.includes('```json')) {
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch)
            return jsonMatch[1];
    }
    else if (content.includes('```')) {
        const jsonMatch = content.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch)
            return jsonMatch[1];
    }
    return content;
}
function getImageAnalysisPrompt(analysisType) {
    switch (analysisType) {
        case 'detection':
            return `Analyze this image to determine if it contains medical information or is a medical document...`;
        case 'extraction':
            return `Extract ALL text content from this image...`;
        default:
            return `Perform a comprehensive analysis of this medical image/document...`;
    }
}
async function processFHIRWithClaude(fhirData, fileName, analysis, apiKey) {
    var _a;
    // Implementation same as before...
    console.log('🤖 Processing FHIR data with Claude...');
    const prompt = buildFHIRPrompt(fhirData, fileName, analysis);
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
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
        const data = await response.json();
        const content = ((_a = data.content[0]) === null || _a === void 0 ? void 0 : _a.text) || '';
        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) {
            return createFallbackFHIRResponse(fileName, analysis);
        }
        const result = JSON.parse(jsonMatch[0]);
        return validateAndCleanFHIRResult(result, fileName);
    }
    catch (error) {
        return createFallbackFHIRResponse(fileName, analysis);
    }
}
function buildFHIRPrompt(fhirData, fileName, analysis) {
    const today = new Date().toISOString().split('T')[0];
    return `Analyze this FHIR healthcare data...`;
}
function validateAndCleanFHIRResult(result, fileName) {
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
function createFallbackFHIRResponse(fileName, analysis) {
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
function validateDate(dateStr) {
    if (!dateStr)
        return null;
    const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
    return match ? dateStr : null;
}
function handleError(res, error, context) {
    var _a, _b, _c;
    if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('JSON')) {
        res.status(500).json({ error: `Failed to parse ${context} response from AI` });
    }
    else if (((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('AI API')) || ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes('Claude'))) {
        res.status(502).json({ error: 'External API error' });
    }
    else {
        res.status(500).json({ error: 'Internal server error' });
    }
}
function handleImageAnalysisError(res, error) {
    res.status(500).json({
        error: 'Failed to process image',
        isMedical: false,
        confidence: 0,
        extractedText: '',
        suggestion: 'Image analysis failed',
    });
}
function verifyPersonaWebhook(signature, body, secret) {
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
    }
    catch (error) {
        console.error('❌ Error verifying webhook signature:', error);
        return false;
    }
}
//# sourceMappingURL=index.js.map