/**
 * useMessaging.ts
 *
 * The main React interface for the Belrose messaging feature.
 *
 * Wires together:
 *   MessageEncryptionService  (encrypt/decrypt via AES-256-GCM)
 *   ConversationKeyService    (AES key retrieval/generation via RSA key exchange)
 *   MessageService            (read/write encrypted blobs to Firestore)
 *
 * Components never touch crypto or Firestore directly — they just call
 * sendMessage() and read from messages[].
 *
 * Usage:
 *   const { messages, sendMessage, isLoading, isSending, error } =
 *     useMessaging(recipientUserId);
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { MessageEncryptionService } from '../services/messageEncryptionService';
import { MessageService } from '../services/messageService';
import type { StoredMessage } from '../services/messageService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A fully decrypted message ready for rendering.
 * This is what components see — no ciphertext, no crypto internals.
 */
export interface DecryptedMessage {
  id: string;
  senderId: string;
  /** Decrypted plaintext */
  text: string;
  sentAt: StoredMessage['sentAt'];
  deliveredAt: StoredMessage['deliveredAt'];
  readAt: StoredMessage['readAt'];
  /** Whether the current user sent this message */
  isOwn: boolean;
}

export interface UseMessagingReturn {
  /** Decrypted messages in chronological order */
  messages: DecryptedMessage[];
  /** True while initial messages are loading */
  isLoading: boolean;
  /** True while sendMessage() is in progress */
  isSending: boolean;
  /** Last error, if any */
  error: Error | null;
  /** Send an encrypted message to the recipient */
  sendMessage: (plaintext: string) => Promise<void>;
  /** Mark all unread messages in this conversation as read */
  markAllRead: () => Promise<void>;
  /** The resolved conversation ID (useful for navigation/linking) */
  conversationId: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages a real-time encrypted conversation with a single recipient.
 *
 * On mount:
 *   1. Gets or creates the conversation document in Firestore
 *   2. Restores message backup so UI shows history immediately
 *   3. Subscribes to messages via onSnapshot
 *   4. Decrypts each incoming message via MessageEncryptionService
 *   5. Marks messages as delivered automatically
 *
 * On sendMessage:
 *   1. Encrypts via MessageEncryptionService (generates conversation key if first message)
 *   2. Writes { body, iv } ciphertext to Firestore via MessageService
 *   3. Optimistically updates local state so sender sees message immediately
 *
 * @param recipientUserId - Firebase Auth UID of the conversation partner
 */
export function useMessaging(recipientUserId: string): UseMessagingReturn {
  const { user } = useAuthContext();
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Ref to hold the Firestore unsubscribe function — cleaned up on unmount
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Cache of already-decrypted message text by messageId.
  // AES-GCM decryption is idempotent  calling it twice on the same message
  // produces the same result. So this cache is a performance optimisation
  // (avoids redundant decryption work when Firestore fires snapshots for unchanged messages).
  const decryptedCacheRef = useRef<Map<string, string>>(new Map());

  // Stable reference to participantIds for use inside callbacks.
  // The tuple order doesn't matter — ConversationKeyService sorts UIDs.
  const participantIdsRef = useRef<[string, string] | null>(null);

  // ---------------------------------------------------------------------------
  // Initialise conversation and subscribe to messages
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user || !recipientUserId || recipientUserId.trim() === '') return;
    if (recipientUserId === user.uid) return;

    let isMounted = true;

    const init = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const convId = await MessageService.getOrCreateConversation(recipientUserId);
        if (!isMounted) return;

        setConversationId(convId);
        participantIdsRef.current = [user.uid, recipientUserId];

        // Subscribe to real-time updates
        const unsubscribe = MessageService.subscribeToMessages(
          convId,
          async storedMessages => {
            if (!isMounted) return;
            await handleIncomingMessages(storedMessages, convId);
          },
          err => {
            if (!isMounted) return;
            console.error('❌ Message subscription error:', err);
            setError(err);
          }
        );

        unsubscribeRef.current = unsubscribe;
      } catch (err: any) {
        if (!isMounted) return;
        console.error('❌ Failed to initialise conversation:', err);
        setError(err instanceof Error ? err : new Error(err.message));
        toast.error('Failed to load conversation');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [user?.uid, recipientUserId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && conversationId && user) {
        MessageService.markAllRead(conversationId, user.uid).catch(err =>
          console.warn('⚠️ Failed to mark messages as read on focus:', err)
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [conversationId, user?.uid]);

  // ---------------------------------------------------------------------------
  // Decrypt incoming messages
  // ---------------------------------------------------------------------------

  /**
   * Processes a batch of StoredMessages from Firestore:
   *   - Decrypts each message via SessionManager
   *   - Marks incoming messages as delivered
   *   - Updates component state with decrypted results
   *
   * Handles decryption failures gracefully — a failed message shows a
   * placeholder rather than crashing the whole conversation.
   */
  const handleIncomingMessages = useCallback(
    async (storedMessages: StoredMessage[], convId: string) => {
      const currentUserId = getAuth().currentUser?.uid;
      if (!currentUserId || !participantIdsRef.current) return;

      const participantIds = participantIdsRef.current;

      const decrypted = await Promise.all(
        storedMessages.map(async (msg): Promise<DecryptedMessage> => {
          const isOwn = msg.senderId === currentUserId;

          // Return cached result to avoid redundant decryption work
          const cached = decryptedCacheRef.current.get(msg.id);
          if (cached !== undefined) {
            return {
              id: msg.id,
              senderId: msg.senderId,
              text: cached,
              sentAt: msg.sentAt,
              deliveredAt: msg.deliveredAt,
              readAt: msg.readAt,
              isOwn,
            };
          }

          // First time seeing this message — decrypt it
          try {
            const plaintext = await MessageEncryptionService.decryptMessage(
              { body: msg.body, iv: msg.iv },
              convId,
              participantIds
            );

            decryptedCacheRef.current.set(msg.id, plaintext);

            if (!msg.deliveredAt && !isOwn) {
              MessageService.markDelivered(convId, msg.id).catch(err =>
                console.warn('⚠️ Failed to mark delivered:', err)
              );
            }

            return {
              id: msg.id,
              senderId: msg.senderId,
              text: plaintext,
              sentAt: msg.sentAt,
              deliveredAt: msg.deliveredAt,
              readAt: msg.readAt,
              isOwn,
            };
          } catch (err) {
            console.error('❌ Failed to decrypt message:', msg.id, err);
            return {
              id: msg.id,
              senderId: msg.senderId,
              text: '[Unable to decrypt message]',
              sentAt: msg.sentAt,
              deliveredAt: msg.deliveredAt,
              readAt: msg.readAt,
              isOwn: false,
            };
          }
        })
      );

      setMessages(decrypted);

      // Mark any unread incoming messages as read
      // Only fires if there are actually unread messages from the other person
      const hasUnreadIncoming = decrypted.some(m => !m.isOwn && !m.readAt);
      if (hasUnreadIncoming && convId && document.visibilityState === 'visible') {
        MessageService.markAllRead(convId, currentUserId).catch(err =>
          console.warn('⚠️ Failed to mark messages as read:', err)
        );
      }

      // Write last-message preview to localStorage for ConversationList
      const lastMessage = decrypted[decrypted.length - 1];
      if (lastMessage) {
        localStorage.setItem(`${currentUserId}_${convId}_preview`, lastMessage.text.slice(0, 60));
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (plaintext: string) => {
      if (!plaintext.trim()) return;
      if (!conversationId || !participantIdsRef.current) {
        toast.error('Conversation not ready — please try again');
        return;
      }

      const currentUserId = getAuth().currentUser?.uid;
      if (!currentUserId) return;

      setIsSending(true);
      setError(null);

      try {
        // 1. Encrypt — generates conversation key if this is the first message
        const encryptedMessage = await MessageEncryptionService.encryptMessage(
          plaintext,
          conversationId,
          participantIdsRef.current
        );

        // 2. Write to Firestore
        const messageId = await MessageService.sendMessage(conversationId, encryptedMessage);

        // Cache plaintext so handleIncomingMessages shows it correctly
        // when Firestore's onSnapshot fires for this message
        decryptedCacheRef.current.set(messageId, plaintext);

        localStorage.setItem(`${currentUserId}_${conversationId}_preview`, plaintext.slice(0, 60));

        // 3. Optimistic update — sender sees message immediately
        const optimisticMessage: DecryptedMessage = {
          id: messageId,
          senderId: currentUserId,
          text: plaintext,
          sentAt: { toDate: () => new Date(), seconds: Date.now() / 1000, nanoseconds: 0 } as any,
          deliveredAt: null,
          readAt: null,
          isOwn: true,
        };

        setMessages(prev => {
          const exists = prev.some(m => m.id === messageId);
          const updated = exists
            ? prev.map(m => (m.id === messageId ? optimisticMessage : m))
            : [...prev, optimisticMessage];

          return updated;
        });
      } catch (err: any) {
        console.error('❌ Failed to send message:', err);
        const error = err instanceof Error ? err : new Error(err.message);
        setError(error);
        toast.error('Failed to send message — please try again');
      } finally {
        setIsSending(false);
      }
    },
    [conversationId]
  );

  // ---------------------------------------------------------------------------
  // Mark all read
  // ---------------------------------------------------------------------------

  const markAllRead = useCallback(async () => {
    if (!conversationId || !user) return;
    try {
      await MessageService.markAllRead(conversationId, user.uid);
    } catch (err) {
      console.warn('⚠️ Failed to mark messages as read:', err);
    }
  }, [conversationId, user?.uid]);

  // ---------------------------------------------------------------------------

  return {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    markAllRead,
    conversationId,
  };
}
