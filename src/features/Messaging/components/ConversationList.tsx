/**
 * ConversationList.tsx
 *
 * Displays a scrollable list of the current user's conversations,
 * ordered by most recent message. Clicking a conversation selects it.
 *
 * Fetches recipient display names via the existing getUserProfile service.
 */

import React, { useEffect, useState } from 'react';
import { MessageSquare, Loader2, Plus } from 'lucide-react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { MessageService } from '../services/messageService';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { base64ToArrayBuffer, formatTimestamp } from '@/utils/dataFormattingUtils';
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
  /** Called when the user clicks the + button */
  onNewConversation: () => void;
}

interface ConversationWithProfile {
  conversation: Conversation;
  recipientProfile: BelroseUserProfile | null;
  recipientUserId: string;
  decryptedPreview: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ConversationList: React.FC<ConversationListProps> = ({
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
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
        const masterKey = await EncryptionKeyManager.getSessionKey();

        const withProfiles = await Promise.all(
          conversations
            .filter(c => c.lastMessageAt !== null)
            .map(async (conversation): Promise<ConversationWithProfile> => {
              const recipientUserId = conversation.participants.find(id => id !== user.uid) ?? '';
              const recipientProfile = recipientUserId
                ? await getUserProfile(recipientUserId)
                : null;

              // Decrypt preview if master key and IV are available
              let decryptedPreview = '';
              if (
                masterKey &&
                conversation.lastMessagePreview &&
                conversation.lastMessagePreviewIV
              ) {
                try {
                  decryptedPreview = await EncryptionService.decryptText(
                    base64ToArrayBuffer(conversation.lastMessagePreview),
                    masterKey,
                    base64ToArrayBuffer(conversation.lastMessagePreviewIV)
                  );
                } catch {
                  // Non-fatal — show empty rather than crash
                }
              }

              return { conversation, recipientProfile, recipientUserId, decryptedPreview };
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
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Conversations
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Conversations
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <p className="text-sm text-destructive">Failed to load conversations</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Header with + button */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Conversations
        </span>
        <button
          onClick={onNewConversation}
          aria-label="New conversation"
          className="w-7 h-7 rounded-full flex items-center justify-center
            text-muted-foreground hover:text-foreground hover:bg-muted
            transition-all duration-150"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 px-6 text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <button
              onClick={onNewConversation}
              className="text-xs text-complement-1 hover:underline mt-1"
            >
              Start one
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {items.map(({ conversation, recipientProfile, recipientUserId, decryptedPreview }) => {
            const isSelected = conversation.id === selectedConversationId;
            const displayName = recipientProfile
              ? `${recipientProfile.firstName ?? ''} ${recipientProfile.lastName ?? ''}`.trim() ||
                recipientProfile.displayName ||
                'Unknown User'
              : 'Loading...';

            const timestamp = conversation.lastMessageAt
              ? formatTimestamp(conversation.lastMessageAt, 'chat')
              : '';

            return (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id, recipientUserId)}
                className={`
              flex items-center gap-3 px-4 py-3 text-left w-full
              transition-all duration-150 border-b border-border/20
              ${isSelected ? ' border-l-4 border-l-primary bg-accent/50 ' : 'hover:bg-accent/30'}
            `}
              >
                <Avatar profile={recipientProfile} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {displayName}
                    </span>
                    {timestamp && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {timestamp}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {decryptedPreview}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};

export default ConversationList;
