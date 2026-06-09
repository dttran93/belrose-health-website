// packages/shared/src/config/aiChat.ts

export interface MediaPart {
  type: 'image' | 'video';
  url: string;
  mimeType: string;
  metadata?: any;
}

export type AIProvider = 'anthropic' | 'google' | 'openai';

export interface AIModelConfig {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
}

export const AVAILABLE_MODELS: AIModelConfig[] = [
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    description: "Anthropic's best combination of speed and intelligence",
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'Fast and affordable',
  },
  {
    id: 'gpt-5.4-nano',
    name: 'GPT-5.4 Nano',
    provider: 'openai',
    description: "OpenAI's fastest and most affordable model",
  },
];

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';

export const DEFAULT_MODEL_ID_BY_PROVIDER: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-2.5-flash',
  openai: 'gpt-5.4-nano',
};
