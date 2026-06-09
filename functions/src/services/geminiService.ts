import { DEFAULT_MODEL_ID_BY_PROVIDER, MediaPart } from '../_shared/aiChat';

export class GeminiService {
  private projectId = 'belrose-757fe';
  private location = 'us-central1';

  private async getAccessToken(): Promise<string> {
    const response = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' } }
    );
    if (!response.ok) throw new Error('Failed to get access token from metadata server');
    const data = (await response.json()) as { access_token: string };
    return data.access_token;
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
    const token = await this.getAccessToken();

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
    const callGemini = async (msgs: any[]) => {
      const url = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${modelName}:streamGenerateContent?alt=sse`;
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contents: msgs,
          system_instruction: { parts: [{ text: systemPrompt }] },
          tools: [{ googleSearch: {} }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
        }),
      });
    };

    // Helper: read a Gemini SSE stream, returns text + any function calls
    const readGeminiStream = async (
      response: Response
    ): Promise<{ text: string; functionCalls: any[]; finishReason: string }> => {
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
                onChunk(part.text); // Stream text to client immediately
              }
              // Gemini signals a search call via functionCall parts
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

    // ── Round 1: initial call ──
    let response = await callGemini(contents);
    if (!response.ok)
      throw new Error(`Gemini API error: ${response.status} - ${await response.text()}`);

    const round1 = await readGeminiStream(response);

    // ── Round 2: if Gemini used search, send tool results back ──
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
        // Tell Gemini "search done, now answer" — it fills in the actual results
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

      await readGeminiStream(response); // streams final response to client
    }
  }
}
