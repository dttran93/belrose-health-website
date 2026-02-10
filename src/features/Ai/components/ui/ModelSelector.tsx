import React from 'react';

interface ModelSelectorProps {
  selectedModel: AIModel;
  availableModels: AIModel[];
  onModelChange: (model: AIModel) => void;
  disabled?: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
}

export type AIProvider = 'claude' | 'openai' | 'gemini' | 'deepseek';

export function ModelSelector({
  selectedModel,
  availableModels,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <select
        id="model-select"
        value={selectedModel.id}
        onChange={e => {
          const model = availableModels.find(m => m.id === e.target.value);
          if (model) onModelChange(model);
        }}
        disabled={disabled}
        className="
          px-1 py-2.5 text-sm
          rounded-lg
          bg-transparent
          hover:bg-secondary
          disabled:bg-gray-100 disabled:cursor-not-allowed
        "
      >
        {availableModels.map(model => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
    </div>
  );
}
