"use strict";
// functions/src/handlers/aiChat.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiChat = void 0;
const params_1 = require("firebase-functions/params");
const cors_1 = __importDefault(require("cors"));
const https_1 = require("firebase-functions/https");
const corsHandler = (0, cors_1.default)({ origin: true });
// Define secrets
const anthropicApiKey = (0, params_1.defineSecret)('ANTHROPIC_KEY');
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
exports.aiChat = (0, https_1.onRequest)({
    timeoutSeconds: 540,
    memory: '1GiB',
    secrets: [anthropicApiKey, geminiApiKey],
}, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        try {
            const { message, healthContext, model, provider, conversationHistory, mediaParts = [], } = req.body;
            if (!message || !provider) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }
            // ✅ Set SSE headers for streaming
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            // Helper to send a chunck to the client
            const sendChunk = (text) => {
                res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
            };
            const sendStatus = (status) => {
                res.write(`data: ${JSON.stringify({ status })}\n\n`);
            };
            switch (provider) {
                case 'anthropic':
                    await streamClaudeAPI(message, healthContext, model, conversationHistory, mediaParts, sendChunk, sendStatus, anthropicApiKey.value());
                    break;
                case 'google':
                    await streamGeminiAPI(message, healthContext, model, conversationHistory, mediaParts, sendChunk, sendStatus);
                    break;
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
            // Signal stream is done
            res.write('data: [DONE]\n\n');
            res.end();
        }
        catch (error) {
            console.error('AI Chat error:', error);
            // If headers not sent yet, send JSON error
            if (!res.headersSent) {
                res.status(500).json({
                    error: error instanceof Error ? error.message : 'Internal server error',
                });
            }
            else {
                res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
                res.end();
            }
        }
    });
});
/**
 * MASTER SYSTEM PROMPT
 * Defines the personality, constraints, and data-handling rules for Belrose's AI Assistant.
 */
const generateSystemPrompt = (healthContext) => {
    return `You are Belrose's AI Health Assistant. Your role is to help the user with any health related questions they may have. If a 
  user's prompt is not health related, try to redirect them towards health questions. However, you recognize that health is a broad 
  topic including social determinants of health, mental health, social relationships, exercise health, the environment, medicine, and much more.
  
You have access to structured health data wrapped in XML tags (<HEALTH_RECORD>, <FILE_ATTACHMENT>, etc.).

## When asked about the user's health data follow these guidelines:

### 1. DATA HANDLING, GROUNDING, & ACCURACY
- Use the [CONTEXT_MANIFEST] at the top of the context to understand the inventory.
- ONLY answer based on the provided records and visual media.
- DO NOT infer, assume, or hallucinate medical details. 
- Reference specific records by their ID or Title (e.g., "In your 'Complete Blood Count' (recordID: abc123) from 2025-05-10...").

### 2. SAFETY & DISCLAIMERS
- A recommendation to consult a qualified healthcare provider for medical decisions is always present in the user interface, but if discussing a serious 
medical problem, reiterate that you are an assistant, not a doctor.

### 3. CITATIONS
- ALWAYS cite reputable medical sources for any health claims, whether from your training knowledge or web search.
- Cite reputable medical sources such as: NHS, CDC, WHO, Mayo Clinic, PubMed, NICE, NEJM, JAMA, NIH, etc.
- Format citations as markdown links inline: [Source Name](URL)
- Place citations IMMEDIATELY after the specific claim they support, not at the end of the sentence. Similar to an APA or MLA citation.
- If multiple sources support the same claim, place them consecutively with no space between them: [Source 1](URL)[Source 2](URL)
- Avoid citing Wikipedia, blogs, or non-peer-reviewed sources.

### 4. WEB SEARCH
Use web_search for questions involving: 
- Current or recent treatment guidelines
- New drug approvals, interactions, dosing, or clinical trials
- Current events in health (e.g. disease outbreaks, new research findings, etc.)
- Anything where guidelines or information may have changed recently

DO NOT Search for: 
- Well-established medical facts unlikely to have change
- Definitions of common conditions
- General health concepts, anatomy, physiology, etc.

Example of correct citation format:
Statins are recommended for LDL above 4.9 mmol/L [NHS](https://nhs.uk/...)[NICE](https://nice.org.uk/...). 

### HEALTH RECORDS CONTEXT:
${healthContext}`;
};
/**
 * Call Anthropic's Claude API
 */
async function streamClaudeAPI(message, healthContext, model, history, mediaParts, onChunk, onStatus, apiKey) {
    const systemPrompt = generateSystemPrompt(healthContext);
    const userContent = [{ type: 'text', text: message }];
    const supportedMedia = mediaParts.filter(part => part.type === 'image');
    supportedMedia.forEach(part => {
        userContent.push({
            type: 'image',
            source: { type: 'base64', media_type: part.mimeType, data: part.url.split(',')[1] },
        });
    });
    const messages = [
        ...history.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userContent },
    ];
    const callClaude = async (msgs) => {
        return fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: model || 'claude-sonnet-4-6',
                max_tokens: 4096,
                temperature: 0.2,
                system: systemPrompt,
                messages: msgs,
                stream: true,
                tools: [
                    {
                        type: 'web_search_20260209',
                        name: 'web_search',
                    },
                ],
                tool_choice: { type: 'auto' },
            }),
        });
    };
    const readStream = async (response) => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = '';
        let stopReason = '';
        const toolUseBlocks = [];
        let currentToolBlock = null;
        let currentToolInput = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
            for (const line of lines) {
                const data = line.replace('data: ', '').trim();
                if (data === '[DONE]' || data === '')
                    continue;
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === 'message_delta') {
                        stopReason = parsed.delta?.stop_reason || '';
                    }
                    // Streaming text chunk — send to client immediately
                    if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                        const deltaText = parsed.delta.text;
                        text += deltaText;
                        onChunk(deltaText);
                    }
                    // Tool use starting — capture the tool name and id
                    if (parsed.type === 'content_block_start') {
                        // Handle both old tool_use and new server_tool_use
                        const blockType = parsed.content_block?.type;
                        const blockName = parsed.content_block?.name;
                        if (blockType === 'tool_use' || blockType === 'server_tool_use') {
                            if (blockName === 'web_search') {
                                onStatus('searching');
                            }
                            currentToolBlock = {
                                id: parsed.content_block.id,
                                name: blockName,
                                type: blockType,
                            };
                            currentToolInput = '';
                        }
                    }
                    // Tool input streaming in
                    if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta') {
                        currentToolInput += parsed.delta.partial_json;
                    }
                    // Tool use block finished
                    if (parsed.type === 'content_block_stop' && currentToolBlock) {
                        try {
                            currentToolBlock.input = JSON.parse(currentToolInput);
                        }
                        catch {
                            currentToolBlock.input = {};
                        }
                        toolUseBlocks.push(currentToolBlock);
                        currentToolBlock = null;
                        currentToolInput = '';
                    }
                }
                catch {
                    // ignore malformed lines
                }
            }
        }
        return { text, toolUseBlocks, stopReason };
    };
    // ── Round 1: initial call ──
    let response = await callClaude(messages);
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
    }
    const round1 = await readStream(response);
    // ── Round 2: legacy fallback for tool_use stop reason ──
    // Note: web_search_20260209 is server-side so this rarely/never triggers,
    // but kept for safety in case of tool type changes.
    if (round1.stopReason === 'tool_use' && round1.toolUseBlocks.length > 0) {
        // Build the assistant message with tool use blocks
        const assistantMessage = {
            role: 'assistant',
            content: [
                ...(round1.text ? [{ type: 'text', text: round1.text }] : []),
                ...round1.toolUseBlocks.map(block => ({
                    type: 'tool_use',
                    id: block.id,
                    name: block.name,
                    input: block.input,
                })),
            ],
        };
        // Tool results — Anthropic handles the actual search,
        // we just tell it the results are ready
        const toolResults = {
            role: 'user',
            content: round1.toolUseBlocks.map(block => ({
                type: 'tool_result',
                tool_use_id: block.id,
                // No content needed — Anthropic fills this in server-side for web_search
            })),
        };
        const updatedMessages = [...messages, assistantMessage, toolResults];
        onStatus('responding');
        response = await callClaude(updatedMessages);
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Claude API error (round 2): ${response.status} - ${error}`);
        }
        await readStream(response); // streams the final response to client via onChunk
    }
}
/**
 * Call Google's Gemini API with streaming + Google Search grounding
 */
async function streamGeminiAPI(message, healthContext, model, history, mediaParts, onChunk, onStatus) {
    const apiKey = geminiApiKey.value();
    if (!apiKey)
        throw new Error('Gemini API key not configured');
    const systemPrompt = generateSystemPrompt(healthContext);
    const modelName = model || 'gemini-2.5-flash';
    // Gemini uses 'user' and 'model' roles (not 'assistant')
    const contents = [
        ...history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        })),
        {
            role: 'user',
            parts: [
                { text: message },
                ...mediaParts.map(part => ({
                    inline_data: { mime_type: part.mimeType, data: part.url.split(',')[1] },
                })),
            ],
        },
    ];
    // Helper: make a streaming request to Gemini
    const callGemini = async (msgs) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: msgs,
                system_instruction: { parts: [{ text: systemPrompt }] },
                tools: [{ googleSearch: {} }], // 👈 Enables grounding with Google Search
                generationConfig: { maxOutputTokens: 4096, temperature: 0.1 },
            }),
        });
    };
    // Helper: read a Gemini SSE stream, returns text + any tool calls
    const readGeminiStream = async (response) => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = '';
        let finishReason = '';
        const functionCalls = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
            for (const line of lines) {
                const data = line.replace('data: ', '').trim();
                if (data === '' || data === '[DONE]')
                    continue;
                try {
                    const parsed = JSON.parse(data);
                    const candidate = parsed.candidates?.[0];
                    if (!candidate)
                        continue;
                    finishReason = candidate.finishReason || finishReason;
                    for (const part of candidate.content?.parts || []) {
                        if (part.text) {
                            text += part.text;
                            onChunk(part.text); // Stream text to client immediately
                        }
                        // Gemini signals a search call via functionCall parts
                        if (part.functionCall) {
                            functionCalls.push(part.functionCall);
                            onStatus('searching');
                        }
                    }
                }
                catch {
                    // Ignore malformed lines
                }
            }
        }
        return { text, functionCalls, finishReason };
    };
    // ── Round 1: initial call ──
    let response = await callGemini(contents);
    if (!response.ok)
        throw new Error(`Gemini API error: ${response.status} - ${await response.text()}`);
    const round1 = await readGeminiStream(response);
    // ── Round 2: if Gemini used search, send tool results back ──
    if (round1.functionCalls.length > 0) {
        // Append what the model said + its tool calls to the conversation
        const updatedContents = [
            ...contents,
            {
                role: 'model',
                parts: [
                    ...(round1.text ? [{ text: round1.text }] : []),
                    ...round1.functionCalls.map(fc => ({ functionCall: fc })),
                ],
            },
            // Tell Gemini "yes, go use that search result" — it fills in the actual data
            {
                role: 'user',
                parts: round1.functionCalls.map(fc => ({
                    functionResponse: {
                        name: fc.name,
                        response: { output: 'Search executed. Use grounding results.' },
                    },
                })),
            },
        ];
        onStatus('responding');
        response = await callGemini(updatedContents);
        if (!response.ok)
            throw new Error(`Gemini API error (round 2): ${response.status} - ${await response.text()}`);
        await readGeminiStream(response); // streams final response to client
    }
}
//# sourceMappingURL=aiChat.js.map