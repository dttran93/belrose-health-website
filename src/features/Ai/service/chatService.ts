// src/features/Ai/services/chatService.ts

/**
 * Chat Service for AI Chat feature. NON-ENCRYPTED. This creates the messages but must be called through encryptedChatService.ts
 * Creates subcollection under each user document in Firestore with chat metadata. Actual messages are a sub-subcollection under each chat document.
 *
 * User/{userId}
 * |_Chats/{chatId}/
 *   Chats contains metadata on Chat for quick listing - timestamps/counts etc (unencrypted) titles (encrypted)
 *        |_ messages/{messageId}
 *          Messages contain the actual content of the conversation (encrypted)
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase/config';

export type ContextType = 'my-records' | 'subject' | 'all-accessible' | 'specific-records';

export interface Chat {
  id: string;
  title: string;
  titleIv?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  subjectId?: string;
  recordIds?: string[];
  recordCount: number;
  messageCount: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contentIv?: string;
  timestamp: Timestamp;
  context?: MessageContext;
}

export interface MessageContext {
  recordReferences?: string[]; // Health record IDs
  attachments?: ContextAttachment[]; // Files attached to this specific message
  imageReferences?: string[]; // Image IDs (from storage)
  documentReferences?: string[]; // Other document references
}

export interface ContextAttachment {
  id: string;
  type: 'image' | 'pdf' | 'document' | 'lab-result' | 'imaging';
  name: string; // Encrypted name (base64)
  nameIv?: string; // IV for decrypting name
  url?: string; // Firebase Storage URL (points to encrypted file)
  mimeType?: string; // Original mime type (unencrypted, safe)
  size?: number; // Original size (unencrypted, safe)
  uploadedAt: Timestamp;
}

// For creating new chats (before Firestore assigns IDs/timestamps)
export interface CreateChatInput {
  title: string;
  titleIv?: string;
  subjectId?: string;
  recordIds?: string[];
  recordCount: number;
}

// For creating new messages
export interface CreateMessageInput {
  role: 'user' | 'assistant';
  content: string;
  contentIv?: string;
  context?: MessageContext;
}

// ============================================================================
// CHAT OPERATIONS
// ============================================================================

/**
 * Create a new chat for a user
 */
export async function createChat(userId: string, input: CreateChatInput): Promise<string> {
  const chatsRef = collection(db, 'users', userId, 'chats');

  const newChat = {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    messageCount: 0,
  };

  const docRef = await addDoc(chatsRef, newChat);
  return docRef.id;
}

/**
 * Get all chats for a user, sorted by most recent
 */
export async function getUserChats(userId: string, maxChats: number = 50): Promise<Chat[]> {
  const chatsRef = collection(db, 'users', userId, 'chats');
  const q = query(chatsRef, orderBy('updatedAt', 'desc'), limit(maxChats));

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Chat[];
}

/**
 * Get a specific chat by ID
 */
export async function getChat(userId: string, chatId: string): Promise<Chat | null> {
  const chatRef = doc(db, 'users', userId, 'chats', chatId);
  const snapshot = await getDoc(chatRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as Chat;
}

/**
 * Update chat metadata (e.g., title, context)
 */
export async function updateChat(
  userId: string,
  chatId: string,
  updates: Partial<Omit<Chat, 'id' | 'createdAt'>>
): Promise<void> {
  const chatRef = doc(db, 'users', userId, 'chats', chatId);

  await updateDoc(chatRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a chat and all its messages
 */
export async function deleteChat(userId: string, chatId: string): Promise<void> {
  const batch = writeBatch(db);

  // Delete all messages in the chat
  const messagesRef = collection(db, 'users', userId, 'chats', chatId, 'messages');
  const messagesSnapshot = await getDocs(messagesRef);

  messagesSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  // Delete the chat document
  const chatRef = doc(db, 'users', userId, 'chats', chatId);
  batch.delete(chatRef);

  await batch.commit();
}

/**
 * Generate a title from the first user message
 * You can enhance this later with AI-generated titles
 */
export function generateChatTitle(firstMessage: string, maxLength: number = 50): string {
  const trimmed = firstMessage.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  // Truncate at word boundary
  const truncated = trimmed.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

/**
 * Add a message to a chat
 */
export async function addMessage(
  userId: string,
  chatId: string,
  input: CreateMessageInput
): Promise<string> {
  const messagesRef = collection(db, 'users', userId, 'chats', chatId, 'messages');

  const newMessage = {
    role: input.role,
    content: input.content,
    contentIv: input.contentIv,
    timestamp: serverTimestamp(),
    ...(input.context && { context: input.context }), // Add entire context object if defined
  };

  const docRef = await addDoc(messagesRef, newMessage);

  // Update chat metadata
  const chatRef = doc(db, 'users', userId, 'chats', chatId);
  await updateDoc(chatRef, {
    updatedAt: serverTimestamp(),
    messageCount: await getMessageCount(userId, chatId),
  });

  return docRef.id;
}

/**
 * Get all messages for a chat, ordered chronologically
 */
export async function getChatMessages(userId: string, chatId: string): Promise<Message[]> {
  const messagesRef = collection(db, 'users', userId, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Message[];
}

/**
 * Get the count of messages in a chat
 */
async function getMessageCount(userId: string, chatId: string): Promise<number> {
  const messagesRef = collection(db, 'users', userId, 'chats', chatId, 'messages');
  const snapshot = await getDocs(messagesRef);
  return snapshot.size;
}

/**
 * Delete a specific message
 */
export async function deleteMessage(
  userId: string,
  chatId: string,
  messageId: string
): Promise<void> {
  const messageRef = doc(db, 'users', userId, 'chats', chatId, 'messages', messageId);
  await deleteDoc(messageRef);

  // Update message count
  const chatRef = doc(db, 'users', userId, 'chats', chatId);
  await updateDoc(chatRef, {
    messageCount: await getMessageCount(userId, chatId),
    updatedAt: serverTimestamp(),
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a new chat and add the first user message in one operation
 * This is useful for starting a new conversation
 */
export async function createChatWithMessage(
  userId: string,
  chatInput: CreateChatInput,
  firstMessage: string,
  context?: MessageContext
): Promise<{ chatId: string; messageId: string }> {
  // Create the chat
  const chatId = await createChat(userId, chatInput);

  // Add the first message
  const messageId = await addMessage(userId, chatId, {
    role: 'user',
    content: firstMessage,
    context,
  });

  return { chatId, messageId };
}

/**
 * Update chat title based on AI response or user input
 */
export async function updateChatTitle(
  userId: string,
  chatId: string,
  newTitle: string
): Promise<void> {
  await updateChat(userId, chatId, { title: newTitle });
}
