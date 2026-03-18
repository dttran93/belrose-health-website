/**
 * NewConversationPanel.tsx
 *
 * Slides in to replace the ConversationList when the user clicks +.
 * Wraps UserSearch and navigates to the conversation on user selection.
 *
 * Rendered inside MessagingView's left pane — it swaps out ConversationList
 * rather than overlaying it, keeping the two-pane layout intact.
 */

import React from 'react';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import UserSearch from '@/features/Users/components/UserSearch';
import type { BelroseUserProfile } from '@/types/core';

interface NewConversationPanelProps {
  onClose: () => void;
  /** Called when a user is selected — parent handles navigation/state update */
  onSelectUser: (userId: string) => void;
}

export const NewConversationPanel: React.FC<NewConversationPanelProps> = ({
  onClose,
  onSelectUser,
}) => {
  const { user } = useAuthContext();

  const handleUserSelect = (selectedUser: BelroseUserProfile) => {
    onClose();
    onSelectUser(selectedUser.uid);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0">
        <button
          onClick={onClose}
          aria-label="Back to conversations"
          className="w-7 h-7 rounded-full flex items-center justify-center
            text-muted-foreground hover:text-foreground hover:bg-muted
            transition-all duration-150 flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-complement-1" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New Message
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Find someone by name, email, or ID. Users who have opted in are searchable by name —
          anyone can be found by exact email or ID.
        </p>

        <UserSearch
          onUserSelect={handleUserSelect}
          excludeUserIds={user ? [user.uid] : []}
          placeholder="Search by name, email, or ID..."
          showFilters={true}
          autoFocus={true}
        />
      </div>
    </div>
  );
};

export default NewConversationPanel;
