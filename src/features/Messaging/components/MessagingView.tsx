/**
 * MessagingView.tsx
 *
 * Top-level messaging UI. Composes ConversationList, MessageThread,
 * and MessageInput into a two-pane layout.
 *
 * Left pane:  conversation list
 * Right pane: active message thread + input
 *
 * Usage:
 *   <MessagingView />         — standalone page
 *   <MessagingView initialRecipientId="uid_abc" />  — open directly to a conversation
 */

import React, { useState, useEffect } from 'react';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { ConversationList } from './ConversationList';
import { MessageThread } from './MessageThread';
import { MessageInput } from './MessageInput';
import { useMessaging } from '../hooks/useMessaging';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import Avatar from '@/features/Users/components/Avatar';
import type { BelroseUserProfile } from '@/types/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessagingViewProps {
  /** Optional — open directly to a conversation on mount */
  initialRecipientId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MessagingView: React.FC<MessagingViewProps> = ({ initialRecipientId }) => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [recipientUserId, setRecipientUserId] = useState<string>(initialRecipientId ?? '');
  const [recipientProfile, setRecipientProfile] = useState<BelroseUserProfile | null>(null);

  // Load recipient profile whenever the selected recipient changes
  useEffect(() => {
    if (!recipientUserId) {
      setRecipientProfile(null);
      return;
    }
    getUserProfile(recipientUserId).then(setRecipientProfile);
  }, [recipientUserId]);

  const handleSelectConversation = (conversationId: string, userId: string) => {
    setSelectedConversationId(conversationId);
    setRecipientUserId(userId);
  };

  const recipientName = recipientProfile
    ? `${recipientProfile.firstName ?? ''} ${recipientProfile.lastName ?? ''}`.trim() ||
      recipientProfile.displayName ||
      'Unknown User'
    : '';

  const hasActiveConversation = !!recipientUserId;

  return (
    <div className="flex h-full bg-background rounded-2xl border border-border overflow-hidden shadow-sm">
      {/* ------------------------------------------------------------------ */}
      {/* LEFT PANE — Conversation list                                        */}
      {/* ------------------------------------------------------------------ */}

      <div
        className={`
          flex flex-col border-r border-border bg-card
          w-full md:w-80 lg:w-96 flex-shrink-0
          ${hasActiveConversation ? 'hidden md:flex' : 'flex'}
        `}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-complement-1" />
            <h2 className="text-base font-semibold text-foreground">Messages</h2>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          <ConversationList
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT PANE — Active thread                                           */}
      {/* ------------------------------------------------------------------ */}

      <div
        className={`
          flex-1 flex flex-col min-w-0
          ${hasActiveConversation ? 'flex' : 'hidden md:flex'}
        `}
      >
        {hasActiveConversation ? (
          <ActiveThread
            recipientUserId={recipientUserId}
            recipientProfile={recipientProfile}
            recipientName={recipientName}
            onBack={() => {
              setSelectedConversationId(null);
              setRecipientUserId('');
            }}
          />
        ) : (
          <EmptyThreadState />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ActiveThread — mounts useMessaging for the selected recipient
// ---------------------------------------------------------------------------

interface ActiveThreadProps {
  recipientUserId: string;
  recipientProfile: BelroseUserProfile | null;
  recipientName: string;
  onBack: () => void;
}

const ActiveThread: React.FC<ActiveThreadProps> = ({
  recipientUserId,
  recipientProfile,
  recipientName,
  onBack,
}) => {
  const { messages, isLoading, isSending, sendMessage, markAllRead } =
    useMessaging(recipientUserId);

  // Mark messages as read when thread comes into view
  useEffect(() => {
    markAllRead();
  }, [recipientUserId]);

  return (
    <>
      {/* Thread header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        {/* Back button — mobile only */}
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>

        <Avatar profile={recipientProfile} size="md" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {recipientName || 'Loading...'}
          </p>
          {recipientProfile?.affiliations && recipientProfile.affiliations.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">
              {recipientProfile.affiliations[0]}
            </p>
          )}
        </div>
      </div>

      {/* Message thread */}
      <MessageThread messages={messages} isLoading={isLoading} recipientName={recipientName} />

      {/* Input */}
      <MessageInput onSend={sendMessage} isSending={isSending} disabled={isLoading} />
    </>
  );
};

// ---------------------------------------------------------------------------
// EmptyThreadState — shown on desktop when no conversation selected
// ---------------------------------------------------------------------------

const EmptyThreadState: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
      <MessageSquare className="w-8 h-8 text-muted-foreground" />
    </div>
    <div>
      <p className="font-semibold text-foreground">Select a conversation</p>
      <p className="text-sm text-muted-foreground mt-1">
        Choose a conversation from the list to start messaging
      </p>
    </div>
  </div>
);

export default MessagingView;
