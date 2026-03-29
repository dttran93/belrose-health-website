import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { ChatMessage } from './ui/ChatMessage';
import { ContextType } from './ui/ContextBadge';
import { ChatInput } from './ui/ChatInput';
import { LayoutSlot } from '@/components/app/LayoutProvider';
import { Button } from '@/components/ui/Button';
import { Message } from '../service/chatService';
import { AIModel, AVAILABLE_MODELS } from './ui/ModelSelector';
import { ChatAttachment } from './ui/AttachmentBadge';

interface AIChatProps {
  healthContext: string | null;
  className?: string;
  contextInfo?: {
    type: ContextType;
    subjectName?: string;
  };
  // Controlled component props
  messages?: Message[];
  isLoading?: boolean;
  error?: Error | null;
  onSendMessage?: (content: string, attachments?: ChatAttachment[]) => Promise<void>;
  onClearChat?: () => void;
  // Model selection
  selectedModel?: AIModel;
  availableModels?: AIModel[];
  onModelChange?: (model: AIModel) => void;
  // Footer and empty state customization
  leftFooterContent?: React.ReactNode;
  aboveInputContent?: React.ReactNode;
  belowInputContent?: React.ReactNode;
  onMessagesChange?: (messageCount: number) => void;
  pendingAttachments?: ChatAttachment[];
  onPendingAttachmentsClear?: () => void;
  onStop?: () => void; // New prop for stopping generation
  onEditMessage: (messageId: string, newContent: string) => Promise<void>;
}

export function AIChat({
  className = '',
  contextInfo,
  messages = [],
  isLoading = false,
  error = null,
  onSendMessage,
  onClearChat,
  selectedModel,
  availableModels = AVAILABLE_MODELS,
  onModelChange,
  leftFooterContent,
  aboveInputContent,
  belowInputContent,
  onMessagesChange,
  pendingAttachments = [],
  onPendingAttachmentsClear,
  onStop,
  onEditMessage,
}: AIChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [showHeaderShadow, setShowHeaderShadow] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);

  // Default to first model if none selected
  const currentModel = selectedModel || availableModels[0];

  if (!currentModel) {
    throw new Error('No AI models available');
  }

  const hasMessages = messages.length > 0;

  // Notify parent when messages change
  useEffect(() => {
    onMessagesChange?.(messages.length);
  }, [messages.length, onMessagesChange]);

  //  When attachments are dropped/pasted, add them
  useEffect(() => {
    if (pendingAttachments.length > 0) {
      setAttachments(prev => [...prev, ...pendingAttachments]);
      onPendingAttachmentsClear?.();
      inputRef.current?.focus();
    }
  }, [pendingAttachments, onPendingAttachmentsClear]);

  // Instant jump when the chat view first appears (no animation)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, []); // runs once on mount

  // Smooth scroll for subsequent messages
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    // Call parent's send message handler
    if (onSendMessage) {
      await onSendMessage(inputValue, attachments);
      setInputValue('');
      setAttachments([]);
      inputRef.current?.focus();
    }
  };

  const handleClearChat = () => {
    if (onClearChat) {
      onClearChat();
    }
  };

  const handleModelChange = (model: AIModel) => {
    if (onModelChange) {
      onModelChange(model);
    }
  };

  const getPlaceholder = () => {
    if (contextInfo && contextInfo.type !== 'my-records') {
      return `Ask about ${contextInfo.subjectName ? contextInfo.subjectName + "'s" : 'these'} records...`;
    }
    return 'Ask a question about your health records...';
  };

  // Empty state - show custom content or default
  if (!hasMessages) {
    return (
      <div className={`relative flex flex-col h-full ${className}`}>
        {/* Empty state content */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-3xl mb-6">{aboveInputContent}</div>
          <div className="max-w-3xl w-full mx-auto">
            {/* Chat Input */}
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSubmit}
              placeholder={getPlaceholder()}
              disabled={isLoading}
              selectedModel={currentModel}
              availableModels={availableModels}
              onModelChange={handleModelChange}
              leftFooterContent={leftFooterContent}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              maxFiles={5}
              isLoading={isLoading}
              onStop={onStop}
            />
          </div>

          {belowInputContent && <div className="w-full max-w-3xl mt-6">{belowInputContent}</div>}
        </div>
      </div>
    );
  }

  // Chat view - with messages
  return (
    <>
      <LayoutSlot slot="header">
        <div className="flex justify-between items-center md:p-2 rounded-lg">
          <div className="flex gap-3">
            <Button onClick={handleClearChat}>New Chat</Button>
          </div>
        </div>
      </LayoutSlot>
      <div className={`relative flex flex-col h-full bg-white ${className}`}>
        {/* Error display */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <div className="flex items-center gap-2 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error.message}</span>
            </div>
          </div>
        )}

        {/* Scrollable messages area*/}
        <div className="absolute inset-0 overflow-auto">
          <div className="w-full max-w-3xl mx-auto px-4">
            {messages.map(message => (
              <ChatMessage key={message.id} message={message} onEdit={onEditMessage} />
            ))}
            <div ref={messagesEndRef} />
            <div className="h-48" />
          </div>
        </div>

        {/* Chat Input */}
        <div className="absolute bottom-0 left-0 right-0">
          {/* Fade gradient so messages don't hard-cut behind input */}
          <div className="w-full max-w-3xl mx-auto h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          <div className="bg-background w-full max-w-3xl mx-auto px-4">
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSubmit}
              placeholder={getPlaceholder()}
              disabled={isLoading}
              selectedModel={currentModel}
              availableModels={availableModels}
              onModelChange={handleModelChange}
              leftFooterContent={leftFooterContent}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              isLoading={isLoading}
              onStop={onStop}
            />
          </div>
          <div className="pb-2 text-xs w-full bg-background text-foreground">
            <span>
              {' '}
              Belrose's AI is not a doctor and can make mistakes. Consult qualified healthcare
              providers for any medical decisions.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
