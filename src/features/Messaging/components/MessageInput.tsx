/**
 * MessageInput.tsx
 *
 * Controlled text input for composing and sending messages.
 * Handles Enter to send, Shift+Enter for newline, and send button.
 * Shows a sending spinner while the encryption + Firestore write is in flight.
 */

import React, { useState, useRef, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageInputProps {
  onSend: (text: string) => Promise<void>;
  isSending: boolean;
  /** Disables input while conversation is initialising */
  disabled?: boolean;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  isSending,
  disabled = false,
  placeholder = 'Message...',
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = text.trim().length > 0 && !isSending && !disabled;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const message = text.trim();
    setText('');
    // Reset textarea height after clear
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSend(message);
  }, [canSend, text, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-expand textarea up to 5 lines
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Reset then set to scrollHeight so it shrinks when text is deleted
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="flex items-end gap-2 px-4 py-3 border-t border-border bg-background">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Loading conversation...' : placeholder}
        disabled={disabled || isSending}
        rows={1}
        className={`
          flex-1 resize-none rounded-2xl border border-border bg-muted/50
          px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground
          focus:outline-none focus:ring-2 focus:ring-complement-1/30 focus:border-complement-1
          transition-all duration-150 leading-5
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        style={{ minHeight: '40px', maxHeight: '120px' }}
      />

      <button
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        className={`
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
          transition-all duration-150
          ${
            canSend
              ? 'bg-primary text-primary-foreground hover:opacity-90 active:scale-95'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }
        `}
      >
        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default MessageInput;
