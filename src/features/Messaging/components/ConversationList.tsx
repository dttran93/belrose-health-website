/**
 * ConversationList.tsx
 *
 * Displays a scrollable list of the current user's conversations,
 * ordered by most recent message. Clicking a conversation selects it.
 *
 * Fetches recipient display names via the existing getUserProfile service.
 */

import React, { useEffect, useState } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { MessageService } from '../services/messageService';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import Avatar from '@/features/Users/components/Avatar';
import type { Conversation } from '../services/messageService';
import type { BelroseUserProfile } from '@/types/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversationListProps {
  /** Currently selected conversation ID */
  selectedConversationId: string | null;
  /** Called when the user clicks a conversation */
  onSelectConversation: (conversationId: string, recipientUserId: string) => void;
}

interface ConversationWithProfile {
  conversation: Conversation;
  recipientProfile: BelroseUserProfile | null;
  recipientUserId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ConversationList: React.FC<ConversationListProps> = ({
  selectedConversationId,
  onSelectConversation,
}) => {
  const { user } = useAuthContext();

  const [items, setItems] = useState<ConversationWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to conversations + load recipient profiles
  useEffect(() => {
    if (!user) return;

    setIsLoading(true);

    const unsubscribe = MessageService.subscribeToConversations(
      async conversations => {
        // For each conversation, identify the other participant and load their profile
        const withProfiles = await Promise.all(
          conversations.map(async (conversation): Promise<ConversationWithProfile> => {
            const recipientUserId = conversation.participants.find(id => id !== user.uid) ?? '';
            const recipientProfile = recipientUserId ? await getUserProfile(recipientUserId) : null;
            return { conversation, recipientProfile, recipientUserId };
          })
        );

        setItems(withProfiles);
        setIsLoading(false);
      },
      err => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 px-6 text-center">
        <p className="text-sm text-destructive">Failed to load conversations</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 px-6 text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No conversations yet</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Conversation list
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col divide-y divide-border">
      {items.map(({ conversation, recipientProfile, recipientUserId }) => {
        const isSelected = conversation.id === selectedConversationId;
        const displayName = recipientProfile
          ? `${recipientProfile.firstName ?? ''} ${recipientProfile.lastName ?? ''}`.trim() ||
            recipientProfile.displayName ||
            'Unknown User'
          : 'Loading...';

        const timestamp = conversation.lastMessageAt
          ? formatTimestamp(conversation.lastMessageAt.toDate())
          : '';

        return (
          <button
            key={conversation.id}
            onClick={() => onSelectConversation(conversation.id, recipientUserId)}
            className={`
              flex items-center gap-3 px-4 py-3 text-left w-full
              transition-all duration-150
              ${isSelected ? 'bg-secondary' : 'hover:bg-muted/50'}
            `}
          >
            <Avatar profile={recipientProfile} size="md" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground truncate">
                  {displayName}
                </span>
                {timestamp && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">{timestamp}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {conversation.lastMessagePreview}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a Date into a human-readable timestamp.
 * Today → "2:34 PM", this week → "Mon", older → "Mar 12"
 */
function formatTimestamp(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default ConversationList;
