// src/config/aiModels.ts

/**
 * Main config lives in shared package to be shared between front and backend
 * This file adds frontend-specific properties i.e. icons.
 */

import { AIModelConfig, AVAILABLE_MODELS } from '@belrose/shared';
import { AnthropicLogo, GoogleLogo, OpenAILogo } from './modelLogos';

// Extend the shared type with the React-only icon field
export interface AIModel extends AIModelConfig {
  icon?: React.ComponentType;
}

const PROVIDER_ICONS: Record<string, React.ComponentType> = {
  anthropic: AnthropicLogo,
  google: GoogleLogo,
  openai: OpenAILogo,
};

export const UI_MODELS: AIModel[] = AVAILABLE_MODELS.map(model => ({
  ...model,
  icon: PROVIDER_ICONS[model.provider],
}));
