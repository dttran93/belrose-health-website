"use strict";
// functions/src/handlers/refineRecord.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.refineRecord = void 0;
/**
 * refineRecord Cloud Function
 *
 * Handles both turns of the record refinement conversation:
 *   turn: 'analyze' → inspect the record, return questions or clean bill of health
 *   turn: 'refine'  → take answers + history, return corrected fhirData/belroseFields
 *
 * Input shape matches what recordRefinementService sends from the client.
 * Output shape matches RefinementAIResponse in the client types.
 */
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const anthropicService_1 = require("../services/anthropicService");
const prompts_1 = require("../utils/prompts");
const anthropicKey = (0, params_1.defineSecret)('ANTHROPIC_KEY');
exports.refineRecord = (0, https_1.onRequest)({
    secrets: [anthropicKey],
    cors: true,
    timeoutSeconds: 120,
}, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        const { turn, fhirData, belroseFields, extractedText, originalText, contextText, isSubjectSelf, hasSubjects, reviewStatus, history, answers, } = req.body;
        if (!turn || !fhirData) {
            res.status(400).json({ error: 'turn and fhirData are required' });
            return;
        }
        if (turn !== 'analyze' && turn !== 'refine') {
            res.status(400).json({ error: 'turn must be analyze or refine' });
            return;
        }
        // hasSubjects and reviewStatus are required for analyze turn only
        if (turn === 'analyze' && (hasSubjects === undefined || !reviewStatus)) {
            res
                .status(400)
                .json({ error: 'hasSubjects and reviewStatus are required for analyze turn' });
            return;
        }
        if (turn === 'refine' && (!history || !answers)) {
            res.status(400).json({ error: 'history and answers are required for refine turn' });
            return;
        }
        const apiKey = anthropicKey.value();
        if (!apiKey) {
            res.status(500).json({ error: 'API key not configured' });
            return;
        }
        const anthropicService = new anthropicService_1.AnthropicService(apiKey);
        let responseText;
        if (turn === 'analyze') {
            // Single turn — build the analyze prompt and send as one message
            const prompt = (0, prompts_1.getRefinementAnalyzePrompt)({
                fhirData,
                belroseFields,
                extractedText,
                originalText,
                contextText,
                isSubjectSelf,
                hasSubjects,
                reviewStatus,
            });
            responseText = await anthropicService.sendTextMessage(prompt, {
                model: anthropicService_1.MODELS.SONNET,
                maxTokens: 2000,
                temperature: 0.1,
            });
        }
        else {
            // Multi-turn — build a proper messages array using sendConversation
            const systemPrompt = (0, prompts_1.getRefinementRefinePrompt)({
                fhirData,
                belroseFields,
                extractedText,
                originalText,
                contextText,
                isSubjectSelf,
            });
            const conversationMessages = [
                { role: 'user', content: systemPrompt },
                ...history.map((m) => ({
                    role: m.role,
                    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                })),
                {
                    role: 'user',
                    content: `Here are my answers to your questions:\n${JSON.stringify(answers, null, 2)}\n\nPlease now return the corrected record data.`,
                },
            ];
            responseText = await anthropicService.sendConversation(conversationMessages, {
                model: anthropicService_1.MODELS.SONNET,
                maxTokens: 4000,
                temperature: 0.1,
            });
        }
        // Parse the JSON response
        const result = anthropicService_1.AnthropicService.parseJSONResponse(responseText);
        // Validate the response has the expected shape
        if (!result.status || !['needs_clarification', 'complete'].includes(result.status)) {
            throw new Error('AI returned invalid response shape');
        }
        // Ensure questions is always an array
        result.questions = result.questions || [];
        res.json(result);
    }
    catch (error) {
        console.error('❌ refineRecord error:', error);
        res.status(500).json({
            error: 'Refinement failed',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
//# sourceMappingURL=refineRecord.js.map