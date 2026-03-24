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
import MessageBubble from './MessageBubble';

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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Two messages are in the same visual group if they're from the same sender
 * and sent within 2 minutes of each other — avoids timestamp/avatar repetition.
 */
function isWithinGroupWindow(a: DecryptedMessage, b: DecryptedMessage): boolean {
  if (!a.sentAt || !b.sentAt) return false;

  // Helper to get a Date regardless of if it's a Timestamp or a serialized object
  const getDate = (ts: any) => {
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000); // Handle serialized Firestore object
    return new Date(ts); // Fallback for strings
  };

  const diffMs = getDate(b).getTime() - getDate(a).getTime();
  return diffMs < 2 * 60 * 1000;
}

export default MessageThread;
