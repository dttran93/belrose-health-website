/**
 * messageService.ts
 *
 * Firestore layer for the Belrose messaging feature.
 *
 * Responsibilities:
 *   - Create and fetch conversations
 *   - Send encrypted messages (store ciphertext blobs)
 *   - Subscribe to real-time message updates via onSnapshot
 *   - Mark messages as delivered/read
 *
 * Security model:
 *   This service stores and retrieves ONLY encrypted ciphertext.
 *   It never sees plaintext — encryption/decryption happens in
 *   messageEncryptionService.ts before calling sendMessage() and after
 *   the onSnapshot listener fires.
 *   Firestore is a zero-knowledge store for message content.
 *
 * Firestore schema:
 *
 *   /conversations/{conversationId}
 *     participants:     string[]                 (array of Firebase Auth UIDs)
 *     encryptedKeys:    Record<string, string>   (RSA-wrapped AES key per participant)
 *     createdAt:        Timestamp
 *     lastMessageAt:    Timestamp                (for sorting conversation list)
 *
 *   /conversations/{conversationId}/messages/{messageId}
 *     senderId:         string         (Firebase Auth UID)
 *     body:             string         (base64 AES-GCM ciphertext)
 *     iv:               string         (base64 12-byte IV — unique per message)
 *     sentAt:           Timestamp
 *     deliveredAt:      Timestamp | null
 *     readAt:           Timestamp | null
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/firebase/config';
import type { EncryptedMessage } from './messageEncryptionService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A conversation document — metadata only, no message content.
 */
export interface Conversation {
  id: string;
  participants: string[];
  /** RSA-OAEP wrapped AES conversation key, one entry per participant UID */
  encryptedKeys: Record<string, string>;
  createdAt: Timestamp;
  lastMessageAt: Timestamp | null;
  /** AES-GCM encrypted preview text (base64) — never stores plaintext */
  lastReadAt?: Record<string, Timestamp>;
}

/**
 * A message document as stored in Firestore.
 * body is AES-GCM ciphertext; iv is the per-message nonce.
 */
export interface StoredMessage {
  id: string;
  senderId: string;
  /** Base64 AES-GCM ciphertext — opaque to the server */
  body: string;
  /** Base64 12-byte IV used for this message's encryption */
  iv: string;
  sentAt: Timestamp;
  deliveredAt: Timestamp | null;
  readAt: Timestamp | null;
}

// ---------------------------------------------------------------------------
// MessageService
// ---------------------------------------------------------------------------

export class MessageService {
  // -------------------------------------------------------------------------
  // Conversations
  // -------------------------------------------------------------------------

  /**
   * Gets or creates a conversation between the current user and a recipient.
   *
   * Conversations are keyed by a deterministic ID derived from both participant
   * UIDs sorted alphabetically — guarantees the same document regardless of
   * who initiates.
   *
   * @param recipientUserId - Firebase Auth UID of the other participant
   * @returns conversationId
   */
  static async getOrCreateConversation(recipientUserId: string): Promise<string> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    if (currentUser.uid === recipientUserId) {
      throw new Error('Cannot create a conversation with yourself');
    }

    const conversationId = buildConversationId(currentUser.uid, recipientUserId);
    const conversationRef = doc(db, 'conversations', conversationId);
    const snapshot = await getDoc(conversationRef);

    if (!snapshot.exists()) {
      await setDoc(conversationRef, {
        participants: [currentUser.uid, recipientUserId],
        encryptedKeys: {}, // populated by ConversationKeyService on first message
        createdAt: serverTimestamp(),
        lastMessageAt: null,
        lastReadAt: {
          [currentUser.uid]: serverTimestamp(),
          [recipientUserId]: serverTimestamp(),
        },
      });

      console.log('✅ Conversation created:', conversationId);
    }

    return conversationId;
  }

  /**
   * Fetches all conversations for the current user, ordered by most recent.
   */
  static async getConversations(): Promise<Conversation[]> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }) as Conversation)
      .sort((a, b) => {
        const aTime = a.lastMessageAt?.toDate().getTime() ?? a.createdAt?.toDate().getTime() ?? 0;
        const bTime = b.lastMessageAt?.toDate().getTime() ?? b.createdAt?.toDate().getTime() ?? 0;
        return bTime - aTime;
      });
  }

  /**
   * Subscribes to conversation list updates in real time.
   * Returns an unsubscribe function — call it on component unmount.
   */
  static subscribeToConversations(
    onUpdate: (conversations: Conversation[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const conversations = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }) as Conversation)
          .sort((a, b) => {
            const aTime =
              a.lastMessageAt?.toDate().getTime() ?? a.createdAt?.toDate().getTime() ?? 0;
            const bTime =
              b.lastMessageAt?.toDate().getTime() ?? b.createdAt?.toDate().getTime() ?? 0;
            return bTime - aTime;
          });
        onUpdate(conversations);
      },
      error => {
        console.error('❌ Conversations listener error:', error);
        onError?.(error);
      }
    );
  }

  // -------------------------------------------------------------------------
  // Messages — Write
  // -------------------------------------------------------------------------

  /**
   * Stores an encrypted message in Firestore.
   *
   * Called by useMessaging AFTER messageEncryptionService.encryptMessage()
   * has produced the { body, iv } payload. This function only ever sees
   * encrypted content.
   *
   * @param conversationId   - The conversation to write to
   * @param encryptedMessage - { body, iv } from MessageEncryptionService
   * @returns messageId of the created document
   */
  static async sendMessage(
    conversationId: string,
    encryptedMessage: EncryptedMessage
  ): Promise<string> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    const messageDoc = await addDoc(messagesRef, {
      senderId: currentUser.uid,
      body: encryptedMessage.body,
      iv: encryptedMessage.iv,
      sentAt: serverTimestamp(),
      deliveredAt: null,
      readAt: null,
    });

    await updateDoc(doc(db, 'conversations', conversationId), {
      lastMessageAt: serverTimestamp(),
      [`lastReadAt.${currentUser.uid}`]: serverTimestamp(),
    });

    console.log('✅ Message sent:', messageDoc.id);
    return messageDoc.id;
  }

  // -------------------------------------------------------------------------
  // Messages — Read / Subscribe
  // -------------------------------------------------------------------------

  /**
   * Subscribes to messages in a conversation in real time.
   *
   * Callback receives raw StoredMessage objects with encrypted bodies.
   * Decryption happens in useMessaging after this fires — this service
   * stays zero-knowledge.
   *
   * Returns an unsubscribe function — call it on component unmount.
   */
  static subscribeToMessages(
    conversationId: string,
    onUpdate: (messages: StoredMessage[]) => void,
    onError?: (error: Error) => void,
    messageLimit = 50
  ): Unsubscribe {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('sentAt', 'asc'),
      limit(messageLimit)
    );

    return onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as StoredMessage);
        onUpdate(messages);
      },
      error => {
        console.error('❌ Messages listener error:', error);
        onError?.(error);
      }
    );
  }

  /**
   * Fetches a single page of messages without a real-time subscription.
   * Useful for loading older message history on scroll.
   */
  static async getMessages(conversationId: string, pageSize = 50): Promise<StoredMessage[]> {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('sentAt', 'asc'),
      limit(pageSize)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as StoredMessage);
  }

  // -------------------------------------------------------------------------
  // Delivery / Read receipts
  // -------------------------------------------------------------------------

  /** Marks a message as delivered. Called when recipient's onSnapshot fires. */
  static async markDelivered(conversationId: string, messageId: string): Promise<void> {
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await updateDoc(messageRef, { deliveredAt: serverTimestamp() });
  }

  /** Marks a message as read. Called when recipient opens the conversation. */
  static async markRead(conversationId: string, messageId: string): Promise<void> {
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await updateDoc(messageRef, { readAt: serverTimestamp() });
  }

  /**
   * Marks all unread messages in a conversation as read.
   * More efficient than calling markRead() per message.
   */
  static async markAllRead(conversationId: string, currentUserId: string): Promise<void> {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      where('senderId', '!=', currentUserId),
      where('readAt', '==', null)
    );

    const snapshot = await getDocs(q);

    await Promise.all(snapshot.docs.map(d => updateDoc(d.ref, { readAt: serverTimestamp() })));

    await updateDoc(doc(db, 'conversations', conversationId), {
      [`lastReadAt.${currentUserId}`]: serverTimestamp(),
    });

    console.log(`✅ Marked ${snapshot.docs.length} messages as read`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a deterministic conversation ID from two user IDs.
 * Sorting alphabetically guarantees the same ID regardless of who initiates.
 */
function buildConversationId(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join('_');
}
