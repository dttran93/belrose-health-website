import React, { useEffect, useRef, useState } from 'react';
import { Send, Plus } from 'lucide-react';
import { AIModel, ModelSelector } from './ModelSelector';
import AttachmentBadge from './AttachmentBadge';

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
  onFilesAttached?: (files: File[]) => void;
  maxFiles?: number;
  acceptedFileTypes?: string;
  attachedFiles: File[];
  onFilesChange: (files: File[]) => void;
}

interface AttachedFile {
  file: File;
  id: string;
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
  onFilesAttached,
  maxFiles = 5,
  acceptedFileTypes = 'image/*,video/*,.pdf,.doc,.docx,.txt',
  attachedFiles,
  onFilesChange,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 56), 240);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (attachedFiles.length + files.length > maxFiles) {
      alert(`You can only attach up to ${maxFiles} files`);
      return;
    }

    onFilesChange([...attachedFiles, ...files]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    onFilesChange(attachedFiles.filter((_, i) => i !== index));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    onSubmit(e);
    // Parent will clear attachedFiles after successful send
  };

  return (
    <div className="w-full bg-transparent">
      <div className="mx-auto px-6 py-4">
        <form onSubmit={handleFormSubmit} className="relative">
          <div className="border border-gray-300 rounded-2xl shadow-sm hover:shadow-md focus-within:shadow-md transition-shadow bg-white">
            {/* Attached Files Display */}
            {attachedFiles.length > 0 && (
              <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <AttachmentBadge
                    key={`${file.name}-${index}`}
                    file={file}
                    onRemove={() => handleRemoveFile(index)}
                  />
                ))}
              </div>
            )}

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
                  onClick={handleAttachClick}
                  disabled={disabled || attachedFiles.length >= maxFiles}
                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="p-2 bg-destructive text-white rounded-lg hover:bg-destructive/50 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedFileTypes}
            onChange={handleFileChange}
            className="hidden"
          />
        </form>
      </div>
    </div>
  );
}
