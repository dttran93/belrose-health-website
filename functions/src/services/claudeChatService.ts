// functions/src/services/claudeChatService.ts

import { DEFAULT_MODEL_ID_BY_PROVIDER, MediaPart } from '../_shared/aiChat';

export class ClaudeChatService {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Anthropic API key is required');
    this.apiKey = apiKey;
  }

  /**
   * Call Anthropic's Claude API
   */
  async streamChat(
    message: string,
    systemPrompt: string,
    model: string,
    history: Array<{ role: string; content: string }>,
    mediaParts: MediaPart[],
    onChunk: (text: string) => void,
    onStatus: (status: string) => void
  ): Promise<void> {
    const userContent: any[] = [{ type: 'text', text: message }];
    const supportedMedia = mediaParts.filter(part => part.type === 'image');
    supportedMedia.forEach(part => {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: part.mimeType, data: part.url.split(',')[1] },
      });
    });

    const messages: any[] = [
      ...history.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: userContent },
    ];

    const callClaude = async (msgs: any[]) => {
      return fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || DEFAULT_MODEL_ID_BY_PROVIDER.anthropic,
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

    const readStream = async (
      response: Response
    ): Promise<{
      text: string;
      toolUseBlocks: any[];
      stopReason: string;
    }> => {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      let stopReason = '';
      const toolUseBlocks: any[] = [];
      let currentToolBlock: any = null;
      let currentToolInput = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.replace('data: ', '').trim();
          if (data === '[DONE]' || data === '') continue;

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
            if (
              parsed.type === 'content_block_delta' &&
              parsed.delta?.type === 'input_json_delta'
            ) {
              currentToolInput += parsed.delta.partial_json;
            }

            // Tool use block finished
            if (parsed.type === 'content_block_stop' && currentToolBlock) {
              try {
                currentToolBlock.input = JSON.parse(currentToolInput);
              } catch {
                currentToolBlock.input = {};
              }
              toolUseBlocks.push(currentToolBlock);
              currentToolBlock = null;
              currentToolInput = '';
            }
          } catch {
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
}
