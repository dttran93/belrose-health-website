// src/features/Ai/context/AIChatContext.tsx

import { createContext, useContext, ReactNode } from 'react';
import { useAIChat } from '@/features/Ai/hooks/useAIChat';
import { useChatHistory } from '@/features/Ai/hooks/useChatHistory';
import { useAuthContext } from '@/features/Auth/AuthContext';
import {
  AIModel,
  AnthropicLogo,
  AVAILABLE_MODELS,
} from '@/features/Ai/components/ui/ModelSelector';
import { FileObject } from '@/types/core';
import { ContextSelection } from '@/features/Ai/components/ui/ContextBadge';
import { useState } from 'react';

// ---- Shape of everything the context exposes ----
interface AIChatContextValue {
  // From useAIChat
  currentChatId: string | null;
  messages: ReturnType<typeof useAIChat>['messages'];
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  chatError: Error | null;
  handleSendMessage: ReturnType<typeof useAIChat>['handleSendMessage'];
  handleLoadChat: ReturnType<typeof useAIChat>['handleLoadChat'];
  handleNewChat: () => void;
  handleStopGeneration: () => void;

  // From useChatHistory
  chats: ReturnType<typeof useChatHistory>['chats'];
  chatsLoading: boolean;
  chatsError: Error | null;
  deleteChat: ReturnType<typeof useChatHistory>['deleteChat'];
  refreshChats: () => void;

  // Model + context selection (lifted up from AppPortal)
  selectedModel: AIModel;
  setSelectedModel: (model: AIModel) => void;
  selectedContext: ContextSelection;
  setSelectedContext: (ctx: ContextSelection) => void;
  allRecords: FileObject[];
  setAllRecords: (records: FileObject[]) => void;
}

const AIChatContext = createContext<AIChatContextValue | null>(null);

export function AIChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();

  const [selectedModel, setSelectedModel] = useState<AIModel>(
    AVAILABLE_MODELS[0] ?? {
      id: 'claude-sonnet-4-5-20250929',
      name: 'Claude Sonnet 4.5',
      provider: 'anthropic',
      icon: AnthropicLogo,
      description: "Anthropic's best combination of speed and intelligence",
    }
  );
  const [allRecords, setAllRecords] = useState<FileObject[]>([]);
  const [selectedContext, setSelectedContext] = useState<ContextSelection>({
    type: 'my-records',
    recordIds: [],
    recordCount: 0,
    description: 'Your health records',
  });

  const chat = useAIChat({
    user,
    allRecords,
    selectedContext,
    selectedModel,
  });

  const history = useChatHistory();

  // Refresh history when a new chat is created
  const handleNewChat = () => {
    chat.handleNewChat();
  };

  return (
    <AIChatContext.Provider
      value={{
        // useAIChat
        currentChatId: chat.currentChatId,
        messages: chat.messages,
        isLoadingMessages: chat.isLoadingMessages,
        isSendingMessage: chat.isSendingMessage,
        chatError: chat.chatError,
        handleSendMessage: chat.handleSendMessage,
        handleLoadChat: chat.handleLoadChat,
        handleNewChat,
        handleStopGeneration: chat.handleStopGeneration,

        // useChatHistory
        chats: history.chats,
        chatsLoading: history.isLoading,
        chatsError: history.error,
        deleteChat: history.deleteChat,
        refreshChats: history.refresh,

        // shared state
        selectedModel,
        setSelectedModel,
        selectedContext,
        setSelectedContext,
        allRecords,
        setAllRecords,
      }}
    >
      {children}
    </AIChatContext.Provider>
  );
}

// ---- Hook to consume context ----
export function useAIChatContext() {
  const ctx = useContext(AIChatContext);
  if (!ctx) throw new Error('useAIChatContext must be used inside AIChatProvider');
  return ctx;
}
