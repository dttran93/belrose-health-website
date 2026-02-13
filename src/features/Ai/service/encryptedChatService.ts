// src/features/Ai/services/encryptedChatService.ts

import {
  createChat,
  getUserChats,
  getChat,
  updateChat,
  addMessage,
  getChatMessages,
  generateChatTitle,
  MessageContext,
  ContextAttachment,
} from './chatService';
import { Chat, Message, CreateChatInput, CreateMessageInput } from './chatService';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';
import { doc, setDoc, getDoc, getFirestore, Timestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ============================================================================
// ENCRYPTED CHAT OPERATIONS
// ============================================================================

/**
 * Create a new chat with encryption
 * Generates a unique encryption key for this chat
 */
export async function createEncryptedChat(userId: string, input: CreateChatInput): Promise<string> {
  console.log('🔐 Creating encrypted chat...');

  // Get user's master key from session
  const masterKey = await EncryptionKeyManager.getSessionKey();
  if (!masterKey) {
    throw new Error('Encryption session not active. Please unlock your encryption.');
  }

  // Generate unique encryption key for this chat
  const chatKey = await EncryptionService.generateFileKey();
  console.log('✓ Chat encryption key generated');

  // Encrypt the title
  const encryptedTitleResult = await EncryptionService.encryptText(input.title, chatKey);

  // Create chat with encrypted title stored directly in document
  const chatId = await createChat(userId, {
    ...input,
    title: arrayBufferToBase64(encryptedTitleResult.encrypted),
    titleIv: arrayBufferToBase64(encryptedTitleResult.iv),
  });
  console.log('✓ Chat document created:', chatId);

  // Store the encrypted chat key
  await storeChatKey(userId, chatId, chatKey, masterKey);
  console.log('✓ Chat key stored');

  console.log('✅ Encrypted chat created successfully');
  return chatId;
}

/**
 * Get all user chats and decrypt their titles
 */
export async function getEncryptedUserChats(
  userId: string,
  maxChats: number = 50
): Promise<Chat[]> {
  console.log('🔓 Loading and decrypting user chats...');

  const masterKey = await EncryptionKeyManager.getSessionKey();
  if (!masterKey) {
    throw new Error('Encryption session not active. Please unlock your encryption.');
  }

  // Get all chats
  const chats = await getUserChats(userId, maxChats);

  // Decrypt titles in parallel
  const decryptedChats = await Promise.all(
    chats.map(async chat => {
      try {
        const chatKey = await getChatKey(userId, chat.id, masterKey);

        // Title and IV stored directly in chat document
        if (chat.title && chat.titleIv) {
          const decryptedTitle = await EncryptionService.decryptText(
            base64ToArrayBuffer(chat.title),
            chatKey,
            base64ToArrayBuffer(chat.titleIv)
          );

          return { ...chat, title: decryptedTitle };
        }

        return chat;
      } catch (error) {
        console.error(`Failed to decrypt chat ${chat.id}:`, error);
        return { ...chat, title: 'Encrypted Chat (Unable to Decrypt)' };
      }
    })
  );

  console.log(`✅ Decrypted ${decryptedChats.length} chats`);
  return decryptedChats;
}

/**
 * Get a specific chat and decrypt its title
 */
export async function getEncryptedChat(userId: string, chatId: string): Promise<Chat | null> {
  const masterKey = await EncryptionKeyManager.getSessionKey();
  if (!masterKey) {
    throw new Error('Encryption session not active. Please unlock your encryption.');
  }

  const chat = await getChat(userId, chatId);
  if (!chat) return null;

  try {
    const chatKey = await getChatKey(userId, chatId, masterKey);

    // Title and IV stored directly in chat document
    if (chat.title && chat.titleIv) {
      const decryptedTitle = await EncryptionService.decryptText(
        base64ToArrayBuffer(chat.title),
        chatKey,
        base64ToArrayBuffer(chat.titleIv)
      );

      return { ...chat, title: decryptedTitle };
    }

    return chat;
  } catch (error) {
    console.error(`Failed to decrypt chat ${chatId}:`, error);
    return { ...chat, title: 'Encrypted Chat (Unable to Decrypt)' };
  }
}

/**
 * Update chat title (encrypted)
 */
export async function updateEncryptedChatTitle(
  userId: string,
  chatId: string,
  newTitle: string
): Promise<void> {
  console.log('🔐 Updating encrypted chat title...');

  const masterKey = await EncryptionKeyManager.getSessionKey();
  if (!masterKey) {
    throw new Error('Encryption session not active. Please unlock your encryption.');
  }

  const chatKey = await getChatKey(userId, chatId, masterKey);

  // Encrypt new title
  const encryptedTitleResult = await EncryptionService.encryptText(newTitle, chatKey);

  // Update chat with encrypted title stored directly in document
  await updateChat(userId, chatId, {
    title: arrayBufferToBase64(encryptedTitleResult.encrypted),
    titleIv: arrayBufferToBase64(encryptedTitleResult.iv),
  });

  console.log('✅ Chat title updated');
}

// ============================================================================
// ENCRYPTED MESSAGE OPERATIONS
// ============================================================================

/**
 * Add an encrypted message to a chat
 */
export async function addEncryptedMessage(
  userId: string,
  chatId: string,
  input: CreateMessageInput
): Promise<string> {
  console.log('🔐 Adding encrypted message...');

  const masterKey = await EncryptionKeyManager.getSessionKey();
  if (!masterKey) {
    throw new Error('Encryption session not active. Please unlock your encryption.');
  }

  // Get chat's encryption key
  const chatKey = await getChatKey(userId, chatId, masterKey);

  // Encrypt message content
  const encryptedContentResult = await EncryptionService.encryptText(input.content, chatKey);

  // Store message with encrypted content directly in document
  const messageId = await addMessage(userId, chatId, {
    role: input.role,
    content: arrayBufferToBase64(encryptedContentResult.encrypted),
    contentIv: arrayBufferToBase64(encryptedContentResult.iv),
    context: input.context,
  });

  console.log('✅ Encrypted message added');
  return messageId;
}

/**
 * Get all messages for a chat and decrypt them
 */
export async function getEncryptedChatMessages(userId: string, chatId: string): Promise<Message[]> {
  console.log('🔓 Loading and decrypting chat messages...');

  const masterKey = await EncryptionKeyManager.getSessionKey();
  if (!masterKey) {
    throw new Error('Encryption session not active. Please unlock your encryption.');
  }

  const messages = await getChatMessages(userId, chatId);
  const chatKey = await getChatKey(userId, chatId, masterKey);

  // Decrypt all messages in parallel
  const decryptedMessages = await Promise.all(
    messages.map(async message => {
      try {
        // Content and IV stored directly in message document
        if (message.content && message.contentIv) {
          const decryptedContent = await EncryptionService.decryptText(
            base64ToArrayBuffer(message.content),
            chatKey,
            base64ToArrayBuffer(message.contentIv)
          );

          // Decrypt attachment names if present
          let decryptedContext = message.context;
          if (message.context?.attachments) {
            const decryptedAttachments = await Promise.all(
              message.context.attachments.map(async attachment => {
                if (attachment.nameIv) {
                  const decryptedName = await EncryptionService.decryptText(
                    base64ToArrayBuffer(attachment.name),
                    chatKey,
                    base64ToArrayBuffer(attachment.nameIv)
                  );
                  return { ...attachment, name: decryptedName };
                }
                return attachment;
              })
            );
            decryptedContext = { ...message.context, attachments: decryptedAttachments };
          }

          return { ...message, content: decryptedContent, context: decryptedContext };
        }

        return message;
      } catch (error) {
        console.error(`Failed to decrypt message ${message.id}:`, error);
        return { ...message, content: '[Unable to decrypt message]' };
      }
    })
  );

  console.log(`✅ Decrypted ${decryptedMessages.length} messages`);
  return decryptedMessages;
}

/**
 * Create a new chat with first encrypted message
 */
export async function createEncryptedChatWithMessage(
  userId: string,
  chatInput: CreateChatInput,
  firstMessage: string,
  context?: CreateMessageInput['context']
): Promise<{ chatId: string; messageId: string }> {
  // Create encrypted chat
  const chatId = await createEncryptedChat(userId, chatInput);

  // Add encrypted first message
  const messageId = await addEncryptedMessage(userId, chatId, {
    role: 'user',
    content: firstMessage,
    context,
  });

  return { chatId, messageId };
}

// ============================================================================
// ENCRYPTED ATTACHMENT OPERATIONS
// ============================================================================

/**
 * Upload and encrypt an attachment for a message
 */
export async function uploadEncryptedAttachment(
  userId: string,
  chatId: string,
  file: File,
  type: ContextAttachment['type']
): Promise<ContextAttachment> {
  console.log('🔐 Uploading encrypted attachment...');

  const masterKey = await EncryptionKeyManager.getSessionKey();
  if (!masterKey) {
    throw new Error('Encryption session not active. Please unlock your encryption.');
  }

  const chatKey = await getChatKey(userId, chatId, masterKey);

  // Encrypt file name
  const encryptedNameResult = await EncryptionService.encryptText(file.name, chatKey);

  // Encrypt file content
  const fileData = await file.arrayBuffer();
  const encryptedFileResult = await EncryptionService.encryptFile(fileData, chatKey);

  // Generate unique ID for this attachment
  const attachmentId = `${chatId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Upload encrypted file to Firebase Storage
  const storage = getStorage();
  const storageRef = ref(storage, `encrypted-attachments/${userId}/${chatId}/${attachmentId}`);

  // Combine IV + encrypted file data into one blob
  const ivArray = new Uint8Array(encryptedFileResult.iv);
  const encryptedArray = new Uint8Array(encryptedFileResult.encrypted);
  const combinedArray = new Uint8Array(ivArray.length + encryptedArray.length);
  combinedArray.set(ivArray, 0);
  combinedArray.set(encryptedArray, ivArray.length);
  const encryptedBlob = new Blob([combinedArray]);

  await uploadBytes(storageRef, encryptedBlob);
  const downloadUrl = await getDownloadURL(storageRef);

  console.log('✅ Encrypted attachment uploaded');

  // Return attachment metadata (encrypted name stored, URL points to encrypted file)
  return {
    id: attachmentId,
    type,
    name: arrayBufferToBase64(encryptedNameResult.encrypted), // Encrypted name
    nameIv: arrayBufferToBase64(encryptedNameResult.iv), // IV for name
    url: downloadUrl, // URL to encrypted file
    mimeType: file.type,
    size: file.size,
    uploadedAt: Timestamp.now(),
  };
}

/**
 * Download and decrypt an attachment
 */
export async function downloadEncryptedAttachment(
  userId: string,
  chatId: string,
  attachment: ContextAttachment
): Promise<{ blob: Blob; fileName: string }> {
  console.log('🔓 Downloading encrypted attachment...');

  const masterKey = await EncryptionKeyManager.getSessionKey();
  if (!masterKey) {
    throw new Error('Encryption session not active. Please unlock your encryption.');
  }

  const chatKey = await getChatKey(userId, chatId, masterKey);

  // Decrypt file name
  const decryptedName = await EncryptionService.decryptText(
    base64ToArrayBuffer(attachment.name),
    chatKey,
    base64ToArrayBuffer(attachment.nameIv!)
  );

  // Download encrypted file
  const response = await fetch(attachment.url!);
  const encryptedData = await response.arrayBuffer();

  // Extract IV (first 12 bytes) and encrypted content
  const iv = encryptedData.slice(0, 12);
  const encrypted = encryptedData.slice(12);

  // Decrypt file
  const decryptedFile = await EncryptionService.decryptFile(encrypted, chatKey, iv);

  console.log('✅ Attachment decrypted');

  return {
    blob: new Blob([decryptedFile], { type: attachment.mimeType }),
    fileName: decryptedName,
  };
}

// ============================================================================
// ENCRYPTION KEY MANAGEMENT
// ============================================================================

/**
 * Store encrypted chat key (similar to wrapped record keys)
 */
async function storeChatKey(
  userId: string,
  chatId: string,
  chatKey: CryptoKey,
  masterKey: CryptoKey
): Promise<void> {
  const db = getFirestore();

  // Encrypt chat key with master key
  const encryptedKeyData = await EncryptionService.encryptKeyWithMasterKey(chatKey, masterKey);

  const wrappedKeyDoc = {
    userId,
    chatId,
    wrappedKey: arrayBufferToBase64(encryptedKeyData),
    createdAt: new Date(),
    isActive: true,
  };

  await setDoc(doc(db, 'wrappedChatKeys', `${chatId}_${userId}`), wrappedKeyDoc);
}

/**
 * Get and decrypt chat key
 */
async function getChatKey(
  userId: string,
  chatId: string,
  masterKey: CryptoKey
): Promise<CryptoKey> {
  const db = getFirestore();
  const wrappedKeyRef = doc(db, 'wrappedChatKeys', `${chatId}_${userId}`);
  const wrappedKeyDoc = await getDoc(wrappedKeyRef);

  if (!wrappedKeyDoc.exists()) {
    throw new Error('Chat encryption key not found');
  }

  const wrappedKeyData = wrappedKeyDoc.data();

  if (!wrappedKeyData.isActive) {
    throw new Error('Chat access has been revoked');
  }

  // Decrypt chat key
  const encryptedKeyData = base64ToArrayBuffer(wrappedKeyData.wrappedKey);
  const chatKeyData = await EncryptionService.decryptKeyWithMasterKey(encryptedKeyData, masterKey);

  return await EncryptionService.importKey(chatKeyData);
}

// Export utility function
export { generateChatTitle };
