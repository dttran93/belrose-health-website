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
 *   It never sees plaintext — encryption/decryption happens in sessionManager.ts
 *   before calling sendMessage() and after calling the onSnapshot listener.
 *   Firestore is a zero-knowledge store for message content.
 *
 * Firestore schema:
 *
 *   /conversations/{conversationId}
 *     participants:     string[]       (array of Firebase Auth UIDs)
 *     createdAt:        Timestamp
 *     lastMessageAt:    Timestamp      (for sorting conversation list)
 *     lastMessagePreview: string       (always "New message" — never plaintext)
 *
 *   /conversations/{conversationId}/messages/{messageId}
 *     senderId:         string         (Firebase Auth UID)
 *     type:             1 | 3          (1 = WhisperMessage, 3 = PreKeyWhisperMessage)
 *     body:             string         (base64 ciphertext)
 *     registrationId:   number         (sender's Signal registration ID)
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
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { arrayBufferToBase64 } from '@/utils/dataFormattingUtils';
import type { EncryptedMessage } from '../lib/sessionManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A conversation document — just metadata, no message content.
 */
export interface Conversation {
  id: string;
  participants: string[];
  createdAt: Timestamp;
  lastMessageAt: Timestamp | null;
  /** AES-GCM encrypted preview text (base64) — never stores plaintext */
  lastMessagePreview: string;
  /** IV for decrypting lastMessagePreview (base64) */
  lastMessagePreviewIV?: string;
}

/**
 * A message document as stored in Firestore.
 * `body` is the base64 ciphertext from SessionCipher.encrypt().
 */
export interface StoredMessage {
  id: string;
  senderId: string;
  /** 3 = PreKeyWhisperMessage (session init), 1 = WhisperMessage (subsequent) */
  type: 1 | 3;
  /** Base64 ciphertext — opaque to the server */
  body: string;
  registrationId: number;
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
   * UIDs sorted alphabetically — this guarantees the same conversation document
   * regardless of who initiates.
   *
   * @param recipientUserId - Firebase Auth UID of the other participant
   * @returns conversationId
   */
  static async getOrCreateConversation(recipientUserId: string): Promise<string> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    // Guard against messaging yourself — would create a broken conversation
    if (currentUser.uid === recipientUserId) {
      throw new Error('Cannot create a conversation with yourself');
    }

    const conversationId = buildConversationId(currentUser.uid, recipientUserId);
    const conversationRef = doc(db, 'conversations', conversationId);
    const snapshot = await getDoc(conversationRef);

    if (!snapshot.exists()) {
      // Create the conversation document
      await setDoc(conversationRef, {
        participants: [currentUser.uid, recipientUserId],
        createdAt: serverTimestamp(),
        lastMessageAt: null,
        lastMessagePreview: 'New conversation',
      });

      console.log('✅ Conversation created:', conversationId);
    }

    return conversationId;
  }

  /**
   * Fetches all conversations for the current user, ordered by most recent.
   *
   * @returns Array of Conversation objects
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
   *
   * @param onUpdate - Called whenever the conversation list changes
   * @param onError  - Called on Firestore error
   */
  static subscribeToConversations(
    onUpdate: (conversations: Conversation[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    // Order by createdAt rather than lastMessageAt for two reasons:
    //   1. lastMessageAt is null on new conversations — Firestore excludes
    //      null values from ordered queries, so new convos would disappear
    //      from the list until the first message is sent
    //   2. Avoids a composite index on (participants, lastMessageAt)
    // We sort client-side by lastMessageAt after fetching instead.
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
          // Sort client-side: most recent message first,
          // falling back to createdAt for conversations with no messages yet
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
   * Called by useMessaging hook AFTER sessionManager.encryptMessage() has
   * produced the ciphertext. This function only ever sees encrypted content.
   *
   * Also updates the conversation's lastMessageAt for sorting.
   *
   * @param conversationId  - The conversation to write to
   * @param encryptedMessage - Ciphertext from SessionCipher.encrypt()
   * @returns messageId of the created document
   */
  static async sendMessage(
    conversationId: string,
    encryptedMessage: EncryptedMessage,
    plaintextPreview: string
  ): Promise<string> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    // Write the encrypted blob — Firestore never sees plaintext
    const messageDoc = await addDoc(messagesRef, {
      senderId: currentUser.uid,
      type: encryptedMessage.type,
      body: encryptedMessage.body,
      registrationId: encryptedMessage.registrationId,
      sentAt: serverTimestamp(),
      deliveredAt: null,
      readAt: null,
    });

    // Encrypt the preview with the user's master key before storing
    // Truncate to 60 chars — enough for a preview, not the full message
    const conversationUpdate: Record<string, any> = {
      lastMessageAt: serverTimestamp(),
      lastMessagePreview: '…', // fallback if encryption fails
    };

    try {
      const masterKey = await EncryptionKeyManager.getSessionKey();
      if (masterKey) {
        const preview = plaintextPreview.trim().slice(0, 60);
        const { encrypted, iv } = await EncryptionService.encryptText(preview, masterKey);
        conversationUpdate.lastMessagePreview = arrayBufferToBase64(encrypted);
        conversationUpdate.lastMessagePreviewIV = arrayBufferToBase64(iv);
      }
    } catch {
      // Non-fatal — preview just shows ellipsis
    }

    await updateDoc(doc(db, 'conversations', conversationId), conversationUpdate);

    console.log('✅ Message sent:', messageDoc.id);
    return messageDoc.id;
  }

  // -------------------------------------------------------------------------
  // Messages — Read / Subscribe
  // -------------------------------------------------------------------------

  /**
   * Subscribes to messages in a conversation in real time.
   *
   * The callback receives raw StoredMessage objects with encrypted bodies.
   * Decryption happens in the useMessaging hook after this callback fires —
   * this service stays zero-knowledge.
   *
   * Returns an unsubscribe function — call it on component unmount.
   *
   * @param conversationId - The conversation to listen to
   * @param onUpdate       - Called with latest messages whenever Firestore updates
   * @param onError        - Called on Firestore error
   * @param messageLimit   - Max messages to fetch (default 50, paginate for more)
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
        const messages = snapshot.docs.map(
          d =>
            ({
              id: d.id,
              ...d.data(),
            }) as StoredMessage
        );
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
   *
   * @param conversationId - The conversation to fetch from
   * @param pageSize       - Number of messages per page (default 50)
   */
  static async getMessages(conversationId: string, pageSize = 50): Promise<StoredMessage[]> {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('sentAt', 'asc'),
      limit(pageSize)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(
      d =>
        ({
          id: d.id,
          ...d.data(),
        }) as StoredMessage
    );
  }

  // -------------------------------------------------------------------------
  // Delivery / Read receipts
  // -------------------------------------------------------------------------

  /**
   * Marks a message as delivered (recipient's device received it).
   * Called automatically when the recipient's onSnapshot listener fires.
   */
  static async markDelivered(conversationId: string, messageId: string): Promise<void> {
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await updateDoc(messageRef, { deliveredAt: serverTimestamp() });
  }

  /**
   * Marks a message as read (recipient opened the conversation).
   * Called when the recipient's conversation view mounts or comes into focus.
   */
  static async markRead(conversationId: string, messageId: string): Promise<void> {
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await updateDoc(messageRef, { readAt: serverTimestamp() });
  }

  /**
   * Marks all unread messages in a conversation as read.
   * More efficient than calling markRead() per message on open.
   *
   * @param conversationId - The conversation to mark
   * @param currentUserId  - Only marks messages sent by the OTHER party
   */
  static async markAllRead(conversationId: string, currentUserId: string): Promise<void> {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      where('senderId', '!=', currentUserId),
      where('readAt', '==', null)
    );

    const snapshot = await getDocs(q);

    // Batch the updates — avoids multiple sequential writes
    await Promise.all(snapshot.docs.map(d => updateDoc(d.ref, { readAt: serverTimestamp() })));

    console.log(`✅ Marked ${snapshot.docs.length} messages as read`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a deterministic conversation ID from two user IDs.
 *
 * Sorting alphabetically guarantees the same ID regardless of who initiates —
 * Alice messaging Bob and Bob messaging Alice both resolve to the same document.
 *
 * Example: buildConversationId("uid_bob", "uid_alice") → "uid_alice_uid_bob"
 */
function buildConversationId(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join('_');
}
