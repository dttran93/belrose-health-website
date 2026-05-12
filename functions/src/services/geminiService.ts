// functions/src/services/geminiService.ts

import { DEFAULT_MODEL_ID_BY_PROVIDER, MediaPart } from '../_shared/aiChat';

export class GeminiService {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Gemini API key is required');
    this.apiKey = apiKey;
  }

  async streamChat(
    message: string,
    systemPrompt: string,
    model: string,
    history: Array<{ role: string; content: string }>,
    mediaParts: MediaPart[],
    onChunk: (text: string) => void,
    onStatus: (status: string) => void
  ): Promise<void> {
    const modelName = model || DEFAULT_MODEL_ID_BY_PROVIDER.google;

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

    const callGemini = (msgs: any[]) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${this.apiKey}&alt=sse`;
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: msgs,
          system_instruction: { parts: [{ text: systemPrompt }] },
          tools: [{ googleSearch: {} }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.1 },
        }),
      });
    };

    const readStream = async (response: Response) => {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      let finishReason = '';
      const functionCalls: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder
          .decode(value)
          .split('\n')
          .filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const data = line.replace('data: ', '').trim();
          if (!data || data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const candidate = parsed.candidates?.[0];
            if (!candidate) continue;
            finishReason = candidate.finishReason || finishReason;
            for (const part of candidate.content?.parts || []) {
              if (part.text) {
                text += part.text;
                onChunk(part.text);
              }
              if (part.functionCall) {
                functionCalls.push(part.functionCall);
                onStatus('searching');
              }
            }
          } catch {
            /* ignore malformed lines */
          }
        }
      }
      return { text, functionCalls, finishReason };
    };

    let response = await callGemini(contents);
    if (!response.ok)
      throw new Error(`Gemini API error: ${response.status} - ${await response.text()}`);

    const round1 = await readStream(response);

    if (round1.functionCalls.length > 0) {
      const updatedContents = [
        ...contents,
        {
          role: 'model',
          parts: [
            ...(round1.text ? [{ text: round1.text }] : []),
            ...round1.functionCalls.map(fc => ({ functionCall: fc })),
          ],
        },
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
        throw new Error(
          `Gemini API error (round 2): ${response.status} - ${await response.text()}`
        );
      await readStream(response);
    }
  }
}
