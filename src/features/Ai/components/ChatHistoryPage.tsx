// src/features/Ai/components/ChatHistoryPage.tsx

import { MessageSquare, Loader2, AlertCircle, Plus } from 'lucide-react';
import { ChatHistoryCard } from './ui/ChatHistoryCard';
import { useNavigate } from 'react-router-dom';
import { useAIChatContext } from './AIChatContext';

export default function ChatHistoryPage() {
  const navigate = useNavigate();
  const {
    chats,
    chatsLoading,
    chatsError,
    currentChatId,
    handleLoadChat,
    handleNewChat,
    deleteChat,
  } = useAIChatContext();

  const onSelectChat = (chatId: string) => {
    handleLoadChat(chatId);
    navigate(`/app/ai/chat/${chatId}`);
  };

  const onNewChat = () => {
    handleNewChat();
    navigate('/app', { replace: true });
  };

  if (chatsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (chatsError) {
    return (
      <div className="flex items-center gap-2 text-red-600 p-4">
        <AlertCircle className="w-5 h-5" />
        <span>{chatsError.message}</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chat History</h1>
          <p className="text-sm text-gray-500 mt-1">{chats.length} conversations</p>
        </div>
        <button
          onClick={onNewChat}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {chats.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No chats yet</p>
          <p className="text-sm mt-1">Start a conversation with your AI assistant</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {chats.map(chat => (
            <ChatHistoryCard
              key={chat.id}
              chat={chat}
              isActive={chat.id === currentChatId}
              onSelect={() => onSelectChat(chat.id)}
              onDelete={() => deleteChat(chat.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
