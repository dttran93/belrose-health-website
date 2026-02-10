import * as functions from 'firebase-functions';
import * as cors from 'cors';

const corsHandler = cors({ origin: true });

interface ChatRequest {
  message: string;
  healthContext: string;
  model: string;
  provider: 'claude' | 'openai' | 'deepseek';
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export const aiChat = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // Only allow POST
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { message, healthContext, model, provider, conversationHistory }: ChatRequest =
        req.body;

      // Validate inputs
      if (!message || !provider) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Route to appropriate provider
      let response: string;

      switch (provider) {
        case 'claude':
          response = await callClaudeAPI(message, healthContext, model, conversationHistory);
          break;
        case 'openai':
          response = await callOpenAIAPI(message, healthContext, model, conversationHistory);
          break;
        case 'deepseek':
          response = await callDeepSeekAPI(message, healthContext, model, conversationHistory);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      res.json({ response });
    } catch (error) {
      console.error('AI Chat error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });
});

/**
 * Call Anthropic's Claude API
 */
async function callClaudeAPI(
  message: string,
  healthContext: string,
  model: string,
  history: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = functions.config().anthropic?.api_key;

  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  // Build system prompt with health context
  const systemPrompt = `You are a helpful medical AI assistant. You have access to the user's health records to answer their questions.

IMPORTANT INSTRUCTIONS:
- Only answer based on the provided health records
- If information is not in the records, say so clearly
- Do not make up or infer medical information
- Provide clear, accurate summaries
- Use plain language alongside medical terms
- Suggest consulting healthcare providers for medical decisions

${healthContext}`;

  // Build conversation messages
  const messages = [
    ...history.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    {
      role: 'user',
      content: message,
    },
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Call OpenAI's API
 */
async function callOpenAIAPI(
  message: string,
  healthContext: string,
  model: string,
  history: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = functions.config().openai?.api_key;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const systemPrompt = `You are a helpful medical AI assistant with access to the user's health records.

IMPORTANT: Only answer based on provided health records. Do not make up information.

${healthContext}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      messages,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Call DeepSeek's API
 */
async function callDeepSeekAPI(
  message: string,
  healthContext: string,
  model: string,
  history: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = functions.config().deepseek?.api_key;

  if (!apiKey) {
    throw new Error('DeepSeek API key not configured');
  }

  const systemPrompt = `You are a helpful medical AI assistant with access to the user's health records.

IMPORTANT: Only answer based on provided health records. Do not make up information.

${healthContext}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ];

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      messages,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
