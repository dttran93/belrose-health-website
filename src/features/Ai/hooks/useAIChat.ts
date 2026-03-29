//src/features/Ai/hooks/useAIChat.ts

/**
 * Custom hook for managing AI chat functionality
 *
 * Handles:
 * - Message sending/receiving
 * - File attachment processing (images, PDFs, documents)
 * - Pasted text attachment processing
 * - Context building (health records + attachments)
 * - Chat CRUD
 * - AI backend communication
 */

import { useState, useCallback, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { BelroseUserProfile, FileObject } from '@/types/core';
import { ContextSelection } from '@/features/Ai/components/ui/ContextBadge';
import { CreateChatInput, generateChatTitle, Message } from '@/features/Ai/service/chatService';
import {
  addEncryptedMessage,
  createEncryptedChatWithMessage,
  getEncryptedChatMessages,
  deleteMessagesAfter,
} from '@/features/Ai/service/encryptedChatService';
import { AIModel } from '@/features/Ai/components/ui/ModelSelector';
import { ContextBuilder } from '@/features/Ai/service/contextBuilder';
import { ContextFormatter, MediaPart } from '@/features/Ai/service/contextFormatter';
import { fileToBase64 } from '@/utils/dataFormattingUtils';
import visionExtractionService from '@/features/AddRecord/services/visionExtractionService';
import textExtractionService from '@/features/AddRecord/services/textExtractionService';
import { ChatAttachment, isPastedText } from '../components/ui/AttachmentBadge';

interface UseAIChatProps {
  user: BelroseUserProfile | null;
  allRecords: FileObject[];
  selectedContext: ContextSelection;
  selectedModel: AIModel;
}

interface UseAIChatReturn {
  // Chat state
  currentChatId: string | null;
  messages: Message[];
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  chatError: Error | null;

  // Chat actions
  handleSendMessage: (messageContent: string, attachments?: ChatAttachment[]) => Promise<void>;
  handleEditMessage: (messageId: string, newContent: string) => Promise<void>;
  handleLoadChat: (chatId: string) => Promise<void>;
  handleNewChat: () => void;
  handleStopGeneration: () => void;
}

export function useAIChat({
  user,
  allRecords,
  selectedContext,
  selectedModel,
}: UseAIChatProps): UseAIChatReturn {
  // ============================================================================
  // STATE
  // ============================================================================

  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatError, setChatError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ============================================================================
  // HELPER: OCR FOR SCANNED PDFs
  // ============================================================================

  /**
   * Extract text from scanned PDFs using OCR
   * Converts PDF pages to images and runs vision/OCR on them
   */
  const extractTextFromPDFViaOCR = useCallback(async (file: File): Promise<string> => {
    console.log('🔍 Starting OCR extraction for PDF:', file.name);

    // Load PDF
    const pdfjsLib = await import('pdfjs-dist');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let allText = '';
    const maxPagesToOCR = 10; // Limit to avoid long processing times
    const pagesToProcess = Math.min(pdf.numPages, maxPagesToOCR);

    console.log(`📄 OCR processing ${pagesToProcess} of ${pdf.numPages} pages...`);

    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      try {
        // Get the page
        const page = await pdf.getPage(pageNum);

        // Render page to canvas
        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale = better OCR
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          console.warn(`Failed to get canvas context for page ${pageNum}`);
          continue;
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        }).promise;

        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas to blob conversion failed'));
          }, 'image/png');
        });

        // Create File from blob for vision service
        const imageFile = new File([blob], `page-${pageNum}.png`, { type: 'image/png' });

        // Extract text using vision service
        console.log(`👁️ Running OCR on page ${pageNum}...`);
        const visionResult = await visionExtractionService.extractImageText(imageFile);

        if (visionResult.text && visionResult.text.trim().length > 0) {
          allText += `\n[Page ${pageNum}]\n${visionResult.text}\n`;
          console.log(`✅ Page ${pageNum}: extracted ${visionResult.text.length} chars`);
        } else {
          console.log(`⚠️ Page ${pageNum}: no text found`);
        }
      } catch (pageError) {
        console.error(`Failed to OCR page ${pageNum}:`, pageError);
        allText += `\n[Page ${pageNum}: OCR failed]\n`;
      }
    }

    if (pdf.numPages > maxPagesToOCR) {
      allText += `\n[Note: Only first ${maxPagesToOCR} of ${pdf.numPages} pages were processed]\n`;
    }

    return allText.trim();
  }, []);

  // ============================================================================
  // HELPER: CALL AI BACKEND
  // ============================================================================

  const streamingIdRef = useRef<string | null>(null);
  const setMessagesRef = useRef(setMessages);
  setMessagesRef.current = setMessages;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  /**
   * Call AI backend via Firebase Cloud Function
   */
  const callAIBackend = async (
    userMessage: string,
    healthContext: string | null,
    model: AIModel,
    mediaParts?: MediaPart[]
  ): Promise<string> => {
    console.log(`🤖 Calling AI: ${model.name} (${model.provider})`);

    const conversationHistory = messagesRef.current.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await fetch('https://us-central1-belrose-757fe.cloudfunctions.net/aiChat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        healthContext,
        model: model.id,
        provider: model.provider,
        mediaParts,
        conversationHistory,
      }),
      signal: abortControllerRef.current?.signal,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get AI response');
    }

    // ✅ Create a temporary streaming message in state
    const streamingId = `streaming-${Date.now()}`;
    streamingIdRef.current = streamingId;

    setMessagesRef.current(prev => [
      ...prev,
      {
        id: streamingId,
        role: 'assistant',
        content: '',
        timestamp: Timestamp.now(),
        isStreaming: true,
        streamingStatus: undefined,
      } as Message,
    ]);

    // ✅ Read the SSE stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.replace('data: ', '').trim();
          if (data === '[DONE]' || data === '') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);

            // Handle status events
            if (parsed.status) {
              setMessagesRef.current(prev =>
                prev.map(m => (m.id === streamingId ? { ...m, streamingStatus: parsed.status } : m))
              );
            }

            if (parsed.delta) {
              accumulatedText += parsed.delta;
              // ✅ Update the live message on every chunk
              setMessagesRef.current(prev =>
                prev.map(m =>
                  m.id === streamingId
                    ? { ...m, content: accumulatedText, streamingStatus: m.streamingStatus } // ✅ clear status once text starts
                    : m
                )
              );
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (error) {
      // Clean up the placeholder on error
      setMessagesRef.current(prev => prev.filter(m => m.id !== streamingId));
      streamingIdRef.current = null;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      throw error;
    }

    setMessagesRef.current(prev =>
      prev.map(m =>
        m.id === streamingId ? { ...m, isStreaming: false, streamingStatus: undefined } : m
      )
    );

    return accumulatedText;
  };

  // ============================================================================
  // MAIN ACTION: SEND MESSAGE
  // ============================================================================

  /**
   * Handle user sending a message with optional attachments
   */
  const handleSendMessage = useCallback(
    async (messageContent: string, attachments?: ChatAttachment[]) => {
      if (!user || !messageContent.trim()) return;

      abortControllerRef.current = new AbortController();

      setIsSendingMessage(true);
      setChatError(null);

      try {
        let activeChatId = currentChatId;

        // ======================================================================
        // STEP 1: Handle long pasted text
        // ======================================================================
        const pastedTextAttachments = attachments?.filter(isPastedText) || [];
        const fileAttachments = (attachments?.filter(a => !isPastedText(a)) as File[]) || [];

        const PASTED_TEXT_THRESHOLD = 2500;
        let finalMessage = messageContent;
        let extractedPastedText: string | null = null;

        // ✅ Check for long message text OR pasted text attachments
        if (messageContent.length > PASTED_TEXT_THRESHOLD) {
          extractedPastedText = messageContent;
          finalMessage =
            'I have attached a long note/document for you to analyze. Please see the "Pasted Text" section in my health context.';
        } else if (pastedTextAttachments.length > 0) {
          // ✅ Combine all pasted text attachments
          extractedPastedText = pastedTextAttachments.map(p => p.content).join('\n\n---\n\n');

          // Keep original message (user already sees the pasted text badges)
          finalMessage = messageContent;
        }

        // ======================================================================
        // STEP 2: Build context (records + attachments + pasted text)
        // ======================================================================
        const builder = new ContextBuilder();
        const targetRecords = allRecords.filter(r => selectedContext.recordIds?.includes(r.id));
        builder.addHealthRecords(targetRecords);

        // Add pasted text if extracted
        if (extractedPastedText) {
          builder.addPastedText(extractedPastedText, 'User Pasted Text');
        }

        // ✅ Process FILE attachments (not pasted text - we already handled that)
        if (fileAttachments && fileAttachments.length > 0) {
          console.log(`📎 Processing ${fileAttachments.length} file(s)...`);

          for (const file of fileAttachments) {
            console.log(`🔍 Processing: ${file.name} (${file.type})`);

            try {
              if (file.type.startsWith('image/')) {
                // ✅ Use AI Vision for images
                console.log(`👁️ Extracting text from image using AI Vision...`);

                try {
                  const visionResult = await visionExtractionService.extractImageText(file);
                  const base64 = await fileToBase64(file);

                  builder.addImageAttachment(file.name, {
                    url: base64,
                    mimeType: file.type,
                    visualDescription: 'User uploaded image',
                    extractedText: visionResult.text,
                    size: file.size,
                  });

                  console.log(
                    `✅ Image processed: ${visionResult.text.length} chars extracted via ${visionResult.method}`
                  );
                } catch (visionError) {
                  console.warn(
                    `Vision extraction failed for ${file.name}, adding image without text:`,
                    visionError
                  );

                  // Still add the image for visual analysis, just without text
                  const base64 = await fileToBase64(file);
                  builder.addImageAttachment(file.name, {
                    url: base64,
                    mimeType: file.type,
                    visualDescription: 'User uploaded image (text extraction failed)',
                    size: file.size,
                  });
                }
              } else if (file.type.startsWith('video/')) {
                // Videos - convert to base64 (Gemini supports, Claude doesn't)
                console.log(`🎥 Processing video: ${file.name}`);
                const base64 = await fileToBase64(file);

                builder.addVideoAttachment(base64, 0, {
                  mimeType: file.type,
                  hasAudio: true,
                });

                console.log(
                  `✅ Video processed (note: Claude doesn't support videos, but Gemini does)`
                );
              } else {
                // ✅ Use text extraction service for documents (PDF, DOCX, TXT, etc.)
                console.log(`📄 Extracting text from document: ${file.name}`);

                try {
                  const extractedText = await textExtractionService.extractText(file);

                  let finalText = extractedText;

                  if (
                    file.type === 'application/pdf' &&
                    (!extractedText || extractedText.trim().length < 50)
                  ) {
                    console.log(
                      `⚠️ PDF has little/no text (${extractedText?.length || 0} chars). Attempting OCR...`
                    );

                    try {
                      const ocrText = await extractTextFromPDFViaOCR(file);

                      if (ocrText && ocrText.length > extractedText.length) {
                        finalText = ocrText;
                        console.log(
                          `✅ OCR extracted ${ocrText.length} chars (better than ${extractedText.length})`
                        );
                      }
                    } catch (ocrError) {
                      console.warn('OCR fallback failed:', ocrError);
                    }
                  }

                  builder.addFileAttachment(file.name, {
                    mimeType: file.type,
                    size: file.size,
                    extractedText: finalText || '[No text could be extracted from this document]',
                  });

                  console.log(`✅ Document processed: ${extractedText.length} chars extracted`);
                } catch (extractionError) {
                  console.error(`Text extraction failed for ${file.name}:`, extractionError);

                  // Still add the file with metadata, include error message
                  builder.addFileAttachment(file.name, {
                    mimeType: file.type,
                    size: file.size,
                    extractedText: `[Text extraction failed: ${extractionError instanceof Error ? extractionError.message : 'Unknown error'}. File metadata available but content could not be read.]`,
                  });
                }
              }
            } catch (fileError) {
              console.error(`Failed to process file ${file.name}:`, fileError);

              // Add a generic error entry for this file
              builder.addFileAttachment(file.name, {
                mimeType: file.type,
                size: file.size,
                extractedText: `[File processing failed: ${fileError instanceof Error ? fileError.message : 'Unknown error'}]`,
              });
            }
          }
        }

        // Format context for AI
        const collection = builder.build();
        const formatted = ContextFormatter.formatForAI(collection);

        console.log('📊 Formatted context:', {
          textLength: formatted.text?.length || 0,
          mediaPartsCount: formatted.mediaParts?.length || 0,
          pastedTextCount: pastedTextAttachments.length,
          fileCount: fileAttachments.length,
        });

        // ======================================================================
        // STEP 3: Create or update chat
        // ======================================================================
        if (!activeChatId) {
          console.log('📝 Creating new chat...');

          if (!selectedContext.subjectId) {
            throw new Error('Subject ID is required to create a chat');
          }

          const chatInput: CreateChatInput = {
            title: generateChatTitle(finalMessage, 50),
            userId: selectedContext.subjectId,
            recordCount: selectedContext.recordCount,
          };

          if (selectedContext.recordIds) {
            chatInput.recordIds = selectedContext.recordIds;
          }

          const { chatId, messageId } = await createEncryptedChatWithMessage(
            user.uid,
            chatInput,
            finalMessage
          );

          console.log('✅ Chat created:', chatId);
          activeChatId = chatId;
          setCurrentChatId(chatId);

          setMessagesRef.current([
            {
              id: messageId,
              role: 'user',
              content: finalMessage,
              timestamp: Timestamp.now(),
            },
          ]);
        } else {
          console.log('💬 Adding message to existing chat...');

          const messageId = await addEncryptedMessage(user.uid, activeChatId, {
            role: 'user',
            content: finalMessage,
          });

          setMessagesRef.current(prev => [
            ...prev,
            {
              id: messageId,
              role: 'user',
              content: finalMessage,
              timestamp: Timestamp.now(),
            },
          ]);
        }

        // ======================================================================
        // STEP 4: Call AI backend
        // ======================================================================
        console.log('🤖 Calling AI with context...');
        const aiResponse = await callAIBackend(
          finalMessage,
          formatted.text,
          selectedModel,
          formatted.mediaParts
        );

        // ======================================================================
        // STEP 5: Store AI response
        // ======================================================================
        if (!activeChatId) {
          throw new Error('Chat ID is missing');
        }

        const streamingIdToReplace = streamingIdRef.current;

        const assistantMessageId = await addEncryptedMessage(user.uid, activeChatId, {
          role: 'assistant',
          content: aiResponse,
        });

        setMessagesRef.current(prev =>
          prev.map(m => (m.id === streamingIdToReplace ? { ...m, id: assistantMessageId } : m))
        );
        streamingIdRef.current = null;

        console.log('✅ Message exchange complete');
      } catch (error) {
        // ✅ Only show error if not cancelled
        if (error instanceof Error && error.message !== 'Request cancelled') {
          console.error('❌ Failed to send message:', error);
          setChatError(error instanceof Error ? error : new Error('Failed to send message'));
        }
      } finally {
        setIsSendingMessage(false);
        abortControllerRef.current = null;
      }
    },
    [user, currentChatId, allRecords, selectedContext, selectedModel, extractTextFromPDFViaOCR]
  );

  // ============================================================================
  // ACTION: EDIT MESSAGE (creates a new branch by truncating)
  // ============================================================================

  /**
   * Edit a user message — deletes all subsequent messages in Firestore
   * and resends from the edited message, creating a new conversation branch
   */
  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!user || !currentChatId || !newContent.trim()) return;

      // Find the message being edited in local state
      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) return;

      const editedMessage = messages[messageIndex];

      if (!editedMessage) {
        throw new Error('Edited message missing');
      }

      try {
        setChatError(null);

        // ✅ Step 1: Delete the edited message + everything after it in Firestore
        // We use the edited message's timestamp so it gets replaced too
        await deleteMessagesAfter(user.uid, currentChatId, editedMessage.timestamp);

        // ✅ Step 2: Truncate local state to everything BEFORE the edited message
        setMessagesRef.current(prev => prev.slice(0, messageIndex));

        console.log(`✂️ Branched from message index ${messageIndex}`);

        // ✅ Step 3: Resend as a new message — reuses all the existing
        // context-building, streaming, and storage logic in handleSendMessage
        await handleSendMessage(newContent);
      } catch (error) {
        console.error('❌ Failed to edit message:', error);
        setChatError(error instanceof Error ? error : new Error('Failed to edit message'));
      }
    },
    [user, currentChatId, messages, handleSendMessage]
  );

  // ============================================================================
  // ACTION: LOAD EXISTING CHAT
  // ============================================================================

  /**
   * Load an existing chat's messages
   */
  const handleLoadChat = useCallback(
    async (chatId: string) => {
      if (!user) return;

      setIsLoadingMessages(true);
      setCurrentChatId(chatId);

      try {
        const chatMessages = await getEncryptedChatMessages(user.uid, chatId);
        setMessagesRef.current(chatMessages);
      } catch (error) {
        console.error('❌ Failed to load chat messages:', error);
        setChatError(error instanceof Error ? error : new Error('Failed to load chat'));
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [user]
  );

  // ============================================================================
  // ACTION: START NEW CHAT
  // ============================================================================

  /**
   * Start a new chat (clear current chat state)
   */
  const handleNewChat = useCallback(() => {
    setCurrentChatId(null);
    setMessagesRef.current([]);
    setChatError(null);
  }, []);

  // ============================================================================
  // ACTION: STOP AI RESPONSE GENERATION
  // ============================================================================

  /**
   * Stop the current AI response generation
   */
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('🛑 Stopping AI generation...');
      abortControllerRef.current.abort();
      setIsSendingMessage(false);
    }
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    currentChatId,
    messages,
    isLoadingMessages,
    isSendingMessage,
    chatError,

    // Actions
    handleSendMessage,
    handleEditMessage,
    handleLoadChat,
    handleNewChat,
    handleStopGeneration,
  };
}
