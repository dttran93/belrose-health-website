// src/features/Ai/components/ui/ChatHistoryList.tsx

import { Trash2, MessageSquare, Plus, ChevronRight, Loader2 } from 'lucide-react';
import { Chat } from '../../service/chatService';

interface ChatHistoryListProps {
  chats: Chat[];
  isLoading: boolean;
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onViewAll: () => void;
}

const SIDEBAR_MAX = 5;

export function ChatHistoryList({
  chats,
  isLoading,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onViewAll,
}: ChatHistoryListProps) {
  const recentChats = chats.slice(0, SIDEBAR_MAX);

  return (
    <div className="px-2 py-3">
      {/* Section header */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Recent Chats
        </span>
        <button
          onClick={onNewChat}
          className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="New chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Chat list */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      ) : recentChats.length === 0 ? (
        <p className="text-xs text-gray-500 px-2 py-2">No chats yet</p>
      ) : (
        <div className="space-y-0.5">
          {recentChats.map(chat => (
            <ChatHistoryItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === currentChatId}
              onSelect={() => onSelectChat(chat.id)}
              onDelete={() => onDeleteChat(chat.id)}
            />
          ))}
        </div>
      )}

      {/* View all link */}
      {chats.length > SIDEBAR_MAX && (
        <button
          onClick={onViewAll}
          className="w-full flex items-center justify-between px-2 py-1.5 mt-1 text-xs text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors"
        >
          <span>View all {chats.length} chats</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// Individual chat row
function ChatHistoryItem({
  chat,
  isActive,
  onSelect,
  onDelete,
}: {
  chat: Chat;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-gray-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
      onClick={onSelect}
    >
      <span className="flex-1 text-sm text-left truncate">{chat.title}</span>

      {/* Trash icon — only visible on hover */}
      <button
        onClick={e => {
          e.stopPropagation(); // Prevent triggering onSelect
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500 hover:text-white text-gray-400 transition-all"
        title="Delete chat"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}
