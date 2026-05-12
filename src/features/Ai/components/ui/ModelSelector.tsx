// src/features/Ai/components/ui/ModelSelector.tsx

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { AIProvider } from '@belrose/shared';
import { AIModel } from '@/config/aiModels';

interface ModelSelectorProps {
  selectedModel: AIModel;
  availableModels: AIModel[];
  onModelChange: (model: AIModel) => void;
  disabled?: boolean;
  defaultModelId?: string;
}

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
        <span className="text-xs font-medium text-gray-700">{selectedModel.name}</span>
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
