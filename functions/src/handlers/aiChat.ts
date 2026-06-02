// functions/src/handlers/aiChat.ts

import { defineSecret } from 'firebase-functions/params';
import cors from 'cors';
import { onRequest } from 'firebase-functions/https';
import { ClaudeChatService } from '../services/claudeChatService';
import { GeminiService } from '../services/geminiService';
import { generateSystemPrompt } from '../utils/aiChatPrompt';
import { OpenAIService } from '../services/openaiService';
import { AIProvider, MediaPart } from '../_shared/aiChat';
import { ALLOWED_ORIGINS } from '../config';

const corsHandler = cors({ origin: ALLOWED_ORIGINS });

// Define secrets
const anthropicApiKey = defineSecret('ANTHROPIC_KEY');
const geminiApiKey = defineSecret('GEMINI_API_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');

interface ChatRequest {
  message: string;
  healthContext: string;
  mediaParts?: MediaPart[];
  model: string;
  provider: AIProvider;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export const aiChat = onRequest(
  {
    timeoutSeconds: 540,
    memory: '1GiB',
    secrets: [anthropicApiKey, geminiApiKey, openaiApiKey],
  },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      try {
        const {
          message,
          healthContext,
          model,
          provider,
          conversationHistory,
          mediaParts = [],
        }: ChatRequest = req.body;

        if (!message || !provider) {
          res.status(400).json({ error: 'Missing required fields' });
          return;
        }

        // ✅ Set SSE headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Helper to send a chunck to the client
        const sendChunk = (text: string) => {
          res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
        };

        const sendStatus = (status: string) => {
          res.write(`data: ${JSON.stringify({ status })}\n\n`);
        };

        const systemPrompt = generateSystemPrompt(healthContext);

        switch (provider) {
          case 'anthropic': {
            const service = new ClaudeChatService(anthropicApiKey.value());
            await service.streamChat(
              message,
              systemPrompt,
              model,
              conversationHistory,
              mediaParts,
              sendChunk,
              sendStatus
            );
            break;
          }
          case 'google': {
            const service = new GeminiService(geminiApiKey.value());
            await service.streamChat(
              message,
              systemPrompt,
              model,
              conversationHistory,
              mediaParts,
              sendChunk,
              sendStatus
            );
            break;
          }
          case 'openai': {
            const service = new OpenAIService(openaiApiKey.value());
            await service.streamChat(
              message,
              systemPrompt,
              model,
              conversationHistory,
              mediaParts,
              sendChunk,
              sendStatus
            );
            break;
          }
          default:
            throw new Error(`Unsupported provider: ${provider}`);
        }

        // Signal stream is done
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (error) {
        console.error('AI Chat error:', error);
        // If headers not sent yet, send JSON error
        if (!res.headersSent) {
          res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error',
          });
        } else {
          res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
          res.end();
        }
      }
    });
  }
);
