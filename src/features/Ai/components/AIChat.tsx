import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, AlertCircle, Plus } from 'lucide-react';
import { useAIChat } from '../hooks/useAIChat';
import { ChatMessage } from './ui/ChatMessage';
import { ModelSelector } from './ui/ModelSelector';
import { FHIRBundle } from '@/types/fhir';
import { ContextType } from './ui/ContextBadge';
import { ChatInput } from './ui/ChatInput';

interface AIChatProps {
  fhirBundle: FHIRBundle | null;
  className?: string;
  contextInfo?: {
    type: ContextType;
    subjectName?: string;
  };
  leftFooterContent?: React.ReactNode;
  emptyStateContent?: React.ReactNode;
  onMessagesChange?: (messageCount: number) => void;
}

export function AIChat({
  fhirBundle,
  className = '',
  contextInfo,
  leftFooterContent,
  emptyStateContent,
  onMessagesChange,
}: AIChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [showHeaderShadow, setShowHeaderShadow] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isLoading,
    error,
    selectedModel,
    availableModels,
    sendMessage,
    setSelectedModel,
    clearChat,
  } = useAIChat({ fhirBundle });

  const hasMessages = messages.length > 0;

  // Notify parent when messages change
  useEffect(() => {
    onMessagesChange?.(messages.length);
  }, [messages.length, onMessagesChange]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track scroll position for header shadow (only when there are messages)
  useEffect(() => {
    if (!hasMessages) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowHeaderShadow(container.scrollTop > 10);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    await sendMessage(inputValue);
    setInputValue('');
    inputRef.current?.focus();
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
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {emptyStateContent || (
            <div className="text-center max-w-md">
              <div className="mb-4 text-gray-400">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Start a conversation</h3>
              <p className="text-sm text-gray-600">
                Ask questions about your health records, medications, test results, or medical
                history.
              </p>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          placeholder={getPlaceholder()}
          disabled={isLoading}
          selectedModel={selectedModel}
          availableModels={availableModels}
          onModelChange={setSelectedModel}
          leftFooterContent={leftFooterContent}
        />
      </div>
    );
  }

  // Chat view - with messages
  return (
    <div className={`relative flex flex-col h-full bg-white ${className}`}>
      {/* Sticky Header with shadow on scroll */}
      <div
        className={`
          sticky top-0 z-10 bg-white
          transition-shadow duration-200
          ${showHeaderShadow ? 'shadow-md' : ''}
        `}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={clearChat}
              disabled={isLoading}
              className="
                p-2 text-gray-600 hover:text-red-600 hover:bg-red-50
                rounded-md transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              title="Clear chat"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          {contextInfo && contextInfo.type !== 'my-records' && (
            <div className="text-xs text-gray-600 italic">
              Viewing {contextInfo.subjectName ? `${contextInfo.subjectName}'s` : 'other'} records
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <div className="flex items-center gap-2 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error.message}</span>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable messages area with fade-out gradient at top */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative">
        {/* Top fade gradient - only visible when scrolled */}
        {showHeaderShadow && (
          <div
            className="
            sticky top-0 left-0 right-0 h-16 
            bg-gradient-to-b from-white via-white/80 to-transparent
            pointer-events-none z-10
          "
          />
        )}

        <div className="divide-y">
          {messages.map(message => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex gap-3 p-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="flex-1">
                <span className="font-semibold text-sm text-gray-900">{selectedModel.name}</span>
                <p className="text-gray-600 text-sm mt-1">Thinking...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat Input */}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        placeholder={getPlaceholder()}
        disabled={isLoading}
        selectedModel={selectedModel}
        availableModels={availableModels}
        onModelChange={setSelectedModel}
        leftFooterContent={leftFooterContent}
      />
    </div>
  );
}
