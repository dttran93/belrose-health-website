// src/features/HomeDashboard/components/MessagesWidget.tsx

/**
 * MessagesWidget
 *
 * Shows the 3 most recent unread conversations.
 * Parent (HomeDashboard) controls visibility — only rendered when unreadMessages > 0.
 *
 * Note: The existing useUnreadMessageCount hook only returns a count, not the
 * conversation details. This widget accepts a simple `count` prop for now and
 * shows a minimal CTA. When a useConversations hook is available you can
 * swap in the richer list view below.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

interface MessagesWidgetProps {
  unreadCount: number;
}

export const MessagesWidget: React.FC<MessagesWidgetProps> = ({ unreadCount }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/app/messages')}
      className="
        flex items-center gap-3 w-full text-left
        hover:bg-muted/50 rounded-lg px-1 py-2
        transition-colors duration-150
        group
      "
    >
      <div className="w-8 h-8 rounded-lg bg-complement-1/10 flex items-center justify-center flex-shrink-0">
        <MessageSquare className="w-4 h-4 text-complement-1" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          {unreadCount} unread message{unreadCount === 1 ? '' : 's'}
        </p>
        <p className="text-xs text-muted-foreground">Tap to open your inbox</p>
      </div>
      <span className="text-xs text-complement-1 group-hover:underline">Open →</span>
    </button>
  );
};

export default MessagesWidget;
