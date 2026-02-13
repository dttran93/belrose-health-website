import React, { useEffect, useRef } from 'react';
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

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Set height based on content, constrained by min/max
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 56), 240);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <div className="w-full bg-transparent">
      {/* Constrained container*/}
      <div className="mx-auto px-6 py-4">
        <form onSubmit={onSubmit} className="relative">
          {/* Input wrapper with border and shadow */}
          <div className="border border-gray-300 rounded-2xl shadow-sm hover:shadow-md focus-within:shadow-md transition-shadow bg-white">
            <textarea
              ref={inputRef}
              value={value}
              onChange={e => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full px-4 pt-4 text-sm bg-transparent resize-none focus:outline-none disabled:bg-gray-50 disabled:cursor-not-allowed rounded-t-2xl overflow-y-auto"
            />

            {/* Input Area Footer */}
            <div className="flex justify-between items-center gap-2 px-4 pb-2">
              {/* Left Side - Attachments & Custom Content */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
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
                    p-2
                    bg-destructive text-white
                rounded-lg
                hover:bg-destructive/50
                disabled:bg-gray-300 disabled:cursor-not-allowed
                transition-colors
                    active:scale-95
              "
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
