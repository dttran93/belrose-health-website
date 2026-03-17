/**
 * MessageThread.tsx
 *
 * Renders the scrollable message history for a single conversation.
 * Receives decrypted messages from useMessaging — has no knowledge
 * of encryption or Firestore.
 *
 * Auto-scrolls to the latest message on new arrivals.
 * Groups consecutive messages from the same sender visually.
 */

import React, { useEffect, useRef } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import type { DecryptedMessage } from '../hooks/useMessaging';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageThreadProps {
  messages: DecryptedMessage[];
  isLoading: boolean;
  /** Recipient's display name — shown in the empty state */
  recipientName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MessageThread: React.FC<MessageThreadProps> = ({
  messages,
  isLoading,
  recipientName,
}) => {
  const { user } = useAuthContext();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-complement-3/10 flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-complement-3" />
        </div>
        <div>
          <p className="font-semibold text-foreground">
            Start a secure conversation with {recipientName}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Messages are end-to-end encrypted — only you and {recipientName} can read them.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Message list
  // ---------------------------------------------------------------------------

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
      {messages.map((message, index) => {
        const prevMessage = messages[index - 1];
        // Group consecutive messages from same sender — skip avatar/name on runs
        const isGrouped =
          prevMessage?.senderId === message.senderId && isWithinGroupWindow(prevMessage, message);

        return <MessageBubble key={message.id} message={message} isGrouped={isGrouped} />;
      })}

      {/* E2EE badge at the bottom — reinforces trust */}
      <div className="flex items-center justify-center gap-1.5 mt-4 mb-1">
        <ShieldCheck className="w-3.5 h-3.5 text-complement-3" />
        <span className="text-xs text-muted-foreground">
          End-to-end encrypted with Signal Protocol
        </span>
      </div>

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: DecryptedMessage;
  isGrouped: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isGrouped }) => {
  const timestamp = message.sentAt
    ? message.sentAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const isDecryptionError = message.text === '[Unable to decrypt message]';

  if (message.isOwn) {
    return (
      <div className={`flex justify-end ${isGrouped ? 'mt-0.5' : 'mt-3'}`}>
        <div className="max-w-[70%] flex flex-col items-end gap-0.5">
          <div
            className={`
              px-4 py-2.5 rounded-2xl text-sm
              bg-primary text-primary-foreground
              ${isGrouped ? 'rounded-tr-md' : ''}
            `}
          >
            {message.text}
          </div>
          {!isGrouped && (
            <span className="text-xs text-muted-foreground px-1">
              {timestamp}
              {message.readAt && <span className="ml-1 text-complement-3">· Read</span>}
              {!message.readAt && message.deliveredAt && (
                <span className="ml-1 text-muted-foreground">· Delivered</span>
              )}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex justify-start ${isGrouped ? 'mt-0.5' : 'mt-3'}`}>
      <div className="max-w-[70%] flex flex-col items-start gap-0.5">
        <div
          className={`
            px-4 py-2.5 rounded-2xl text-sm
            ${
              isDecryptionError
                ? 'bg-destructive/10 text-destructive italic'
                : 'bg-muted text-foreground'
            }
            ${isGrouped ? 'rounded-tl-md' : ''}
          `}
        >
          {message.text}
        </div>
        {!isGrouped && <span className="text-xs text-muted-foreground px-1">{timestamp}</span>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Two messages are in the same visual group if they're from the same sender
 * and sent within 2 minutes of each other — avoids timestamp/avatar repetition.
 */
function isWithinGroupWindow(a: DecryptedMessage, b: DecryptedMessage): boolean {
  if (!a.sentAt || !b.sentAt) return false;
  const diffMs = b.sentAt.toDate().getTime() - a.sentAt.toDate().getTime();
  return diffMs < 2 * 60 * 1000; // 2 minutes
}

export default MessageThread;
