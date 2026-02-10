import React, { useRef } from 'react';
import { Send, Plus } from 'lucide-react';
import { AIModel, ModelSelector } from './ModelSelector';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  selectedModel: AIModel;
  availableModels: AIModel[];
  onModelChange: (model: AIModel) => void;
  leftFooterContent?: React.ReactNode;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ask a question...',
  disabled = false,
  selectedModel,
  availableModels,
  onModelChange,
  leftFooterContent,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <div className="sticky bottom-0 bg-white border border-gray-200 p-4 rounded-lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <textarea
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="
            flex-1 px-4 py-2 text-sm w-full
            bg-transparent
            resize-none
            focus:outline-none
            disabled:bg-gray-100 disabled:cursor-not-allowed
          "
          style={{
            minHeight: '40px',
            maxHeight: '120px',
          }}
        />

        {/* Input Area Footer */}
        <div className="flex justify-between items-center gap-2">
          {/* Left Side - Attachments & Custom Content */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              title="Attach files"
            >
              <Plus className="w-5 h-5" />
            </button>
            {leftFooterContent}
          </div>

          {/* Right Side - Model Selector & Submit */}
          <div className="flex items-center gap-2">
            <ModelSelector
              selectedModel={selectedModel}
              availableModels={availableModels}
              onModelChange={onModelChange}
              disabled={disabled}
            />
            <button
              type="submit"
              disabled={!value.trim() || disabled}
              className="
                px-4 py-2
                bg-primary text-white
                rounded-lg
                hover:bg-blue-700
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                disabled:bg-gray-300 disabled:cursor-not-allowed
                transition-colors
              "
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
