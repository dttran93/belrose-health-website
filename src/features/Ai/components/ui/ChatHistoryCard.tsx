//src/features/Ai/components/ui/ChatHistoryCard.tsx

import { Clock, MessageSquare, Trash2 } from 'lucide-react';
import { Chat } from '../../service/chatService';

export function ChatHistoryCard({
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
  const date = chat.updatedAt?.toDate?.();
  const formattedDate = date
    ? date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const formattedTime = date
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
        isActive
          ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {/* Delete button */}
      <button
        onClick={e => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 text-gray-400 transition-all"
        title="Delete chat"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Icon + title */}
      <div className="flex items-start gap-3 mb-3 pr-6">
        <div className={`p-2 rounded-lg flex-shrink-0 ${isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
          <MessageSquare className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
        </div>
        <p className="font-medium text-gray-900 text-sm leading-snug line-clamp-2">{chat.title}</p>
      </div>

      {/* Metadata */}
      <div className="mt-auto flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {chat.messageCount} messages
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formattedDate} {formattedTime}
        </span>
      </div>
    </div>
  );
}
