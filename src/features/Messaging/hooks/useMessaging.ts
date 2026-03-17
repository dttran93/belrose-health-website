/**
 * useMessaging.ts
 *
 * The main React interface for the Belrose messaging feature.
 *
 * Wires together:
 *   SessionManager  (encrypt/decrypt via Signal Protocol)
 *   MessageService  (read/write encrypted blobs to Firestore)
 *   KeyBundleService (OPK replenishment after sends)
 *
 * Components never touch crypto or Firestore directly — they just call
 * sendMessage() and read from messages[]. Everything else is invisible.
 *
 * Usage:
 *   const { messages, sendMessage, isLoading, isSending, error } =
 *     useMessaging(recipientUserId);
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { SessionManager } from '../lib/sessionManager';
import { MessageService } from '../services/messageService';
import { KeyBundleService } from '../services/keyBundleService';
import { generateAdditionalOneTimePreKeys } from '../lib/keyGeneration';
import type { StoredMessage } from '../services/messageService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A fully decrypted message ready for rendering.
 * This is what components see — no ciphertext, no Signal internals.
 */
export interface DecryptedMessage {
  id: string;
  senderId: string;
  /** Decrypted plaintext content */
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
 *   2. Subscribes to messages via onSnapshot
 *   3. Decrypts each incoming message via SessionManager
 *   4. Marks messages as delivered automatically
 *
 * On sendMessage:
 *   1. Encrypts plaintext via SessionManager (X3DH if first message)
 *   2. Writes ciphertext to Firestore via MessageService
 *   3. Checks OPK supply and replenishes if low
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

  // Ref to track highest OPK keyId used — needed for replenishment
  const lastPreKeyIdRef = useRef<number>(0);

  // ---------------------------------------------------------------------------
  // Initialise conversation and subscribe to messages
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user || !recipientUserId) return;

    let isMounted = true;

    const init = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get or create the Firestore conversation document
        const convId = await MessageService.getOrCreateConversation(recipientUserId);
        if (!isMounted) return;
        setConversationId(convId);

        // Subscribe to real-time message updates
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

    // Cleanup: unsubscribe from Firestore listener on unmount or recipient change
    return () => {
      isMounted = false;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [user?.uid, recipientUserId]);

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
      const auth = getAuth();
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) return;

      const decrypted = await Promise.all(
        storedMessages.map(async (msg): Promise<DecryptedMessage> => {
          const isOwn = msg.senderId === currentUserId;

          // Don't decrypt our own messages — we already have the plaintext
          // from when we sent them. We store it in local state at send time.
          // Attempting to decrypt our own messages would fail (wrong direction).
          if (isOwn) {
            return {
              id: msg.id,
              senderId: msg.senderId,
              text: '[Sent message]', // Replaced by optimistic state — see sendMessage()
              sentAt: msg.sentAt,
              deliveredAt: msg.deliveredAt,
              readAt: msg.readAt,
              isOwn: true,
            };
          }

          // Decrypt incoming message
          try {
            const plaintext = await SessionManager.decryptMessage(msg.senderId, {
              type: msg.type,
              body: msg.body,
              registrationId: msg.registrationId,
            });

            // Mark as delivered now that we've successfully decrypted it
            if (!msg.deliveredAt) {
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
              isOwn: false,
            };
          } catch (err) {
            // Decryption can fail if:
            //   - Session state is out of sync (device switch, cleared IndexedDB)
            //   - Message was already decrypted (ratchet already advanced)
            // Show a placeholder rather than crashing.
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
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------

  /**
   * Encrypts and sends a plaintext message to the recipient.
   *
   * Flow:
   *   1. Encrypt via SessionManager (handles X3DH if first message)
   *   2. Write ciphertext to Firestore via MessageService
   *   3. Optimistically add plaintext to local state so sender sees it immediately
   *   4. Check OPK supply and replenish if running low
   */
  const sendMessage = useCallback(
    async (plaintext: string) => {
      if (!plaintext.trim()) return;
      if (!conversationId) {
        toast.error('Conversation not ready — please try again');
        return;
      }

      const auth = getAuth();
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) return;

      setIsSending(true);
      setError(null);

      try {
        // 1. Encrypt
        const encryptedMessage = await SessionManager.encryptMessage(recipientUserId, plaintext);

        // 2. Write to Firestore
        const messageId = await MessageService.sendMessage(conversationId, encryptedMessage);

        // 3. Optimistic update — add our plaintext immediately so the sender
        //    doesn't see "[Sent message]" while waiting for the Firestore round-trip
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
          // Replace placeholder if it exists, otherwise append
          const exists = prev.some(m => m.id === messageId);
          if (exists) return prev.map(m => (m.id === messageId ? optimisticMessage : m));
          return [...prev, optimisticMessage];
        });

        // 4. Check OPK supply — replenish if running low
        // Non-blocking: don't await, failure here shouldn't affect the send
        checkAndReplenishPreKeys(currentUserId).catch(err =>
          console.warn('⚠️ OPK replenishment check failed:', err)
        );
      } catch (err: any) {
        console.error('❌ Failed to send message:', err);
        const error = err instanceof Error ? err : new Error(err.message);
        setError(error);
        toast.error('Failed to send message — please try again');
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, recipientUserId]
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
  // OPK replenishment
  // ---------------------------------------------------------------------------

  /**
   * Checks OPK supply and generates + uploads a fresh batch if running low.
   * Called after every message send — cheap Firestore read, non-blocking.
   */
  const checkAndReplenishPreKeys = async (userId: string) => {
    // Generate new batch starting from after the last known keyId
    // lastPreKeyIdRef tracks this across sends in this session
    const newPreKeys = await generateAdditionalOneTimePreKeys(lastPreKeyIdRef.current + 1);

    // Update our ref so next replenishment starts from the right keyId
    const lastKey = newPreKeys.at(-1);
    if (lastKey) {
      lastPreKeyIdRef.current = lastKey.keyId;
    }

    await KeyBundleService.checkAndReplenishPreKeys(userId, newPreKeys);
  };

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
