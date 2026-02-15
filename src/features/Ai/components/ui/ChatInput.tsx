import React, { ClipboardEvent, useEffect, useRef } from 'react';
import { Send, Plus, CornerDownLeft } from 'lucide-react';
import { AIModel, ModelSelector } from './ModelSelector';
import AttachmentBadge, {
  ChatAttachment,
  createPastedTextAttachment,
  isPastedText,
} from './AttachmentBadge';

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
  attachments: ChatAttachment[];
  onAttachmentsChange: (attachments: ChatAttachment[]) => void;
  maxFiles?: number;
  acceptedFileTypes?: string;
  pastedTextThreshold?: number;
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
  attachments,
  onAttachmentsChange,
  maxFiles = 5,
  acceptedFileTypes = 'image/*,video/*,.pdf,.doc,.docx,.txt',
  pastedTextThreshold = 2500,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================================================
  // AUTO-RESIZE TEXTAREA
  // ============================================================================
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 56), 240);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  // ============================================================================
  // AUTOMATIC PASTE DETECTION
  // ============================================================================
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');

    if (pastedText.length > pastedTextThreshold) {
      e.preventDefault();

      // Create pasted text attachment
      const pastedAttachment = createPastedTextAttachment(pastedText);
      onAttachmentsChange([...attachments, pastedAttachment]);

      // Add note to message
      const prefix = value.trim() ? value + '\n\n' : '';
      onChange(prefix + '[Pasted text attached]');
    }
  };

  // ============================================================================
  // PASTE INLINE HANDLER
  // ============================================================================
  const handlePasteInline = (attachmentId: string) => {
    const attachment = attachments.find(a => isPastedText(a) && a.id === attachmentId);

    if (!attachment || !isPastedText(attachment)) return;

    // Move content back to textarea
    const prefix = value.replace('[Pasted text attached]', '').trim();
    const newValue = prefix ? prefix + '\n\n' + attachment.content : attachment.content;
    onChange(newValue);

    // Remove the attachment
    const newAttachments = attachments.filter(a =>
      isPastedText(a) ? a.id !== attachmentId : true
    );
    onAttachmentsChange(newAttachments);

    // Focus textarea
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ============================================================================
  // KEYBOARD HANDLING
  // ============================================================================
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  // ============================================================================
  // FILE ATTACHMENT HANDLING
  // ============================================================================
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Count only file attachments (not pasted text)
    const fileAttachments = attachments.filter(a => !isPastedText(a));

    if (fileAttachments.length + files.length > maxFiles) {
      alert(`You can only attach up to ${maxFiles} files`);
      return;
    }

    // Add files to attachments
    onAttachmentsChange([...attachments, ...files]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ============================================================================
  // REMOVE ATTACHMENT
  // ============================================================================
  const handleRemoveAttachment = (attachmentId: string) => {
    const newAttachments = attachments.filter(a => {
      if (isPastedText(a)) {
        return a.id !== attachmentId;
      } else {
        return (a as File).name !== attachmentId;
      }
    });
    onAttachmentsChange(newAttachments);
  };

  // ============================================================================
  // FORM SUBMIT
  // ============================================================================
  const handleFormSubmit = (e: React.FormEvent) => {
    onSubmit(e);
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  const fileAttachmentCount = attachments.filter(a => !isPastedText(a)).length;

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="w-full bg-transparent">
      <div className="mx-auto px-6 py-4">
        <form onSubmit={handleFormSubmit} className="relative">
          <div className="border border-gray-300 rounded-2xl shadow-sm hover:shadow-md focus-within:shadow-md transition-shadow bg-white">
            {/* Attached Files & Pasted Text Display */}
            {attachments.length > 0 && (
              <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2">
                {attachments.map((attachment, index) => {
                  const id = isPastedText(attachment) ? attachment.id : (attachment as File).name;

                  return (
                    <AttachmentBadge
                      key={`${id}-${index}`}
                      attachment={attachment}
                      onRemove={() => handleRemoveAttachment(id)}
                      onPasteInline={
                        isPastedText(attachment) ? () => handlePasteInline(id) : undefined
                      }
                    />
                  );
                })}
              </div>
            )}

            {/* Textarea with paste detection */}
            <textarea
              ref={inputRef}
              value={value}
              onChange={e => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
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
                  disabled={disabled || fileAttachmentCount >= maxFiles}
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
