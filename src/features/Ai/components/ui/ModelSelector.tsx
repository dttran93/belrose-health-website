// src/features/Ai/components/ui/ModelSelector.tsx

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface ModelSelectorProps {
  selectedModel: AIModel;
  availableModels: AIModel[];
  onModelChange: (model: AIModel) => void;
  disabled?: boolean;
  defaultModelId?: string;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  provider: AIProvider;
  icon?: React.ComponentType;
}

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'deepseek';

const AnthropicLogo = () => (
  <svg width="16" height="16" viewBox="0 0 92 64" fill="currentColor" className="text-gray-700">
    <path d="M66.4915 0H52.5029L78.0115 64H92.0001L66.4915 0Z" />
    <path d="M26.08 0L0.571472 64H14.8343L20.0512 50.56H46.7374L51.9543 64H66.2172L40.7086 0H26.08ZM24.6647 38.6743L33.3943 16.1829L42.1239 38.6743H24.6647Z" />
  </svg>
);

const GoogleLogo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    icon: AnthropicLogo,
    description: "Anthropic's best combination of speed and intelligence",
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    icon: GoogleLogo,
    description: 'Fast and affordable',
  },
];

export function ModelSelector({
  selectedModel,
  availableModels,
  onModelChange,
  disabled = false,
  defaultModelId,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calculate dropdown position
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 350; // Approximate max height
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;

      setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
    }
  }, [isOpen]);

  const handleSelectModel = (model: AIModel) => {
    onModelChange(model);
    setIsOpen(false);
  };

  const defaultModel = defaultModelId
    ? availableModels.find(m => m.id === defaultModelId)
    : availableModels[0];

  // Group models by provider
  const modelsByProvider = availableModels.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    },
    {} as Record<AIProvider, AIModel[]>
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : isOpen ? 'bg-gray-100' : 'hover:bg-gray-50'
        }`}
      >
        <span className="text-sm font-medium text-gray-700">{selectedModel.name}</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown Menu */}
          <div
            className={`absolute right-0 w-70 bg-white border border-gray-200 rounded-xl shadow-xl z-50 ${
              openUpward ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            <div className="max-h-96">
              {/* Default Model (if specified) */}
              {defaultModel && (
                <>
                  <div className="m-2">
                    <ModelOption
                      model={defaultModel}
                      isSelected={selectedModel.id === defaultModel.id}
                      onSelect={handleSelectModel}
                      showBadge
                    />
                  </div>
                  <div className="border-t border-gray-200" />
                </>
              )}

              {/* Models grouped by provider */}
              {Object.entries(modelsByProvider).map(([provider, models], index) => (
                <div key={provider} className="m-2">
                  {models.map(model => (
                    <ModelOption
                      key={model.id}
                      model={model}
                      isSelected={selectedModel.id === model.id}
                      onSelect={handleSelectModel}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Model option component with hover tooltip
interface ModelOptionProps {
  model: AIModel;
  isSelected: boolean;
  onSelect: (model: AIModel) => void;
  showBadge?: boolean;
}

function ModelOption({ model, isSelected, onSelect, showBadge }: ModelOptionProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => onSelect(model)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
          isSelected
            ? 'bg-blue-50 border border-blue-200'
            : 'hover:bg-gray-50 border border-transparent'
        }`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Model Info */}
          <div className="text-left flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {model.icon && (
                <div className="flex-shrink-0">
                  <model.icon />
                </div>
              )}
              <span className="text-xs text-gray-900 truncate">{model.name}</span>
              {showBadge && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                  Default
                </span>
              )}
            </div>
          </div>

          {/* Selected indicator */}
          {isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
        </div>
      </button>

      {/* Tooltip on hover - shows full description */}
      {showTooltip && model.description.length && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap max-w-xs">
          {model.description}
          {/* Arrow pointing left */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 transform rotate-45 translate-x-1" />
        </div>
      )}
    </div>
  );
}
