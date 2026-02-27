// src/features/Ai/hooks/useChatHistory.ts

import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { Chat } from '../service/chatService';
import { deleteChat } from '../service/chatService';
import { getEncryptedUserChats } from '../service/encryptedChatService';

export function useChatHistory(maxChats: number = 50) {
  const { user } = useAuthContext();
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchChats = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const decryptedChats = await getEncryptedUserChats(user.uid, maxChats);
      setChats(decryptedChats);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load chats'));
    } finally {
      setIsLoading(false);
    }
  }, [user, maxChats]);

  // Load on mount
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      if (!user) return;
      try {
        await deleteChat(user.uid, chatId);
        // Optimistically remove from state without re-fetching
        setChats(prev => prev.filter(c => c.id !== chatId));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to delete chat'));
      }
    },
    [user]
  );

  return {
    chats,
    isLoading,
    error,
    refresh: fetchChats,
    deleteChat: handleDeleteChat,
  };
}
