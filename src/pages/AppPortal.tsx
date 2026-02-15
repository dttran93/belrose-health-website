// src/pages/AppPortal.tsx

/**
 * The main portal page for the Belrose App. This is the landing page after login and serves as the entry point for the AI Health Assistant feature.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { FileObject } from '@/types/core';
import { SubjectInfo } from '@/features/Ai/components/ui/SubjectList';
import { ContextSelection } from '@/features/Ai/components/ui/ContextBadge';
import {
  getAccessibleRecords,
  getAvailableSubjects,
} from '@/features/Ai/service/recordContextService';
import {
  ContextAttachment,
  CreateChatInput,
  generateChatTitle,
  Message,
} from '@/features/Ai/service/chatService';
import {
  addEncryptedMessage,
  createEncryptedChatWithMessage,
  downloadEncryptedAttachment,
  getEncryptedChatMessages,
  uploadEncryptedAttachment,
} from '@/features/Ai/service/encryptedChatService';
import { AIModel } from '@/features/Ai/components/ui/ModelSelector';
import { Timestamp } from 'firebase/firestore';
import {
  AIHealthAssistantView,
  LoadingView,
  UnauthenticatedView,
  ErrorView,
  NoRecordsView,
} from '@/features/Ai/components/AIAssistantView';
import { AVAILABLE_MODELS } from '@/features/Ai/components/AIChat';
import { ContextBuilder } from '@/features/Ai/service/contextBuilder';
import { ContextFormatter, MediaPart } from '@/features/Ai/service/contextFormatter';
import { fileToBase64 } from '@/utils/dataFormattingUtils';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import visionExtractionService from '@/features/AddRecord/services/visionExtractionService';
import textExtractionService from '@/features/AddRecord/services/textExtractionService';
import { useFileDrop } from '@/hooks/useFileDrop';
import { FileDragOverlay } from '@/components/ui/FileDragOverlay';

export default function AppPortal() {
  const { user, loading: authLoading } = useAuthContext();

  // ============================================================================
  // STATE
  // ============================================================================

  // Data state
  const [allRecords, setAllRecords] = useState<FileObject[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<SubjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Chat state
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatError, setChatError] = useState<Error | null>(null);

  // AI Model selection
  const availableModels: AIModel[] = AVAILABLE_MODELS;
  const DEFAULT_MODEL: AIModel = AVAILABLE_MODELS[0] ?? {
    id: 'claude-sonnet-4-20250514',
    name: 'Fallback Model',
    provider: 'anthropic',
    description: "Claude's best combination of speed and intelligence",
  };

  const [selectedModel, setSelectedModel] = useState<AIModel>(DEFAULT_MODEL);

  // Context state
  const [selectedContext, setSelectedContext] = useState<ContextSelection>({
    type: 'my-records',
    subjectId: null,
    recordCount: 0,
    description: 'Your health records',
  });

  // Drag and Drop state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const { isDragging } = useFileDrop({
    onDrop: setPendingFiles,
    global: true,
  });

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Fetch all accessible records and subjects
  useEffect(() => {
    if (!user) {
      setAllRecords([]);
      setAvailableSubjects([]);
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        if (!user) {
          throw new Error('User Missing');
        }

        setLoading(true);

        // Fetch all records user has access to
        const records = await getAccessibleRecords(user.uid);

        // Decrypt Records
        console.log('🔓 Decrypting records...');
        const decryptedRecords = await RecordDecryptionService.decryptRecords(records);
        console.log('✅ Records decrypted:', decryptedRecords.length);

        setAllRecords(decryptedRecords);

        // Get available subjects from decrypted records
        const subjects = await getAvailableSubjects(decryptedRecords, user.uid);
        setAvailableSubjects(subjects);

        // Set initial context to user's own records
        const myRecords = records.filter(r => r.subjects?.includes(user.uid));
        setSelectedContext({
          type: 'my-records',
          subjectId: user.uid,
          recordIds: myRecords.map(r => r.id),
          recordCount: myRecords.length,
          description: `Your ${myRecords.length} health records`,
        });

        setError(null);
      } catch (err) {
        console.error('Error fetching records:', err);
        setError(err instanceof Error ? err : new Error('Failed to load health records'));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  // Handle context change
  const handleContextChange = (newContext: ContextSelection) => {
    setSelectedContext(newContext);
  };

  // ============================================================================
  // MESSAGE HANDLERS
  // ============================================================================

  /**
   * Handle user sending a message with optional attachments
   */
  const handleSendMessage = async (messageContent: string, files?: File[]) => {
    if (!user || !messageContent.trim()) return;

    setIsSendingMessage(true);
    setChatError(null);

    try {
      let activeChatId = currentChatId;

      // ========================================================================
      // STEP 1: Handle long pasted text
      // ========================================================================
      const PASTED_TEXT_THRESHOLD = 2500;
      let finalMessage = messageContent;
      let extractedPastedText: string | null = null;

      if (messageContent.length > PASTED_TEXT_THRESHOLD) {
        extractedPastedText = messageContent;
        finalMessage =
          'I have attached a long note/document for you to analyze. Please see the "Pasted Text" section in my health context.';
      }

      // ========================================================================
      // STEP 2: Build context (records + attachments + pasted text)
      // ========================================================================
      const builder = new ContextBuilder();
      const targetRecords = allRecords.filter(r => selectedContext.recordIds?.includes(r.id));
      builder.addHealthRecords(targetRecords);

      // Add pasted text if extracted
      if (extractedPastedText) {
        builder.addPastedText(extractedPastedText, 'Large User Note');
      }

      // Process file attachments with text/vision extraction
      if (files && files.length > 0) {
        console.log(`📎 Processing ${files.length} file(s)...`);

        for (const file of files) {
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
                  extractedText: visionResult.text, // ✅ Include OCR/Vision text
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
                hasAudio: true, // Assume yes, we don't check
              });

              console.log(
                `✅ Video processed (note: Claude doesn't support videos, but Gemini does)`
              );
            } else {
              // ✅ Use text extraction service for documents (PDF, DOCX, TXT, etc.)
              console.log(`📄 Extracting text from document: ${file.name}`);

              try {
                const extractedText = await textExtractionService.extractText(file);

                let finalText = 'text_extraction';
                let extractionMethod = 'text_extraction';

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
                      extractionMethod = 'ocr_fallback';
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

      // Debug: Check what we built
      console.log('📦 Built collection:', {
        totalItems: collection.totalItems,
        items: collection.items.map(item => ({
          type: item.type,
          id: item.id,
          hasUrl: 'url' in item ? !!(item as any).url : false,
          hasExtractedText: 'extractedText' in item ? !!(item as any).extractedText : false,
          extractedTextLength: 'extractedText' in item ? (item as any).extractedText?.length : 0,
        })),
      });

      const formatted = ContextFormatter.formatForAI(collection);

      console.log('📊 Formatted context:', {
        textLength: formatted.text?.length || 0,
        mediaPartsCount: formatted.mediaParts?.length || 0,
        firstMediaPart: formatted.mediaParts?.[0]
          ? {
              type: formatted.mediaParts[0].type,
              mimeType: formatted.mediaParts[0].mimeType,
              hasUrl: !!formatted.mediaParts[0].url,
              urlLength: formatted.mediaParts[0].url?.length || 0,
            }
          : null,
      });

      // ========================================================================
      // STEP 3: Create or update chat
      // ========================================================================
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

        setMessages([
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

        setMessages(prev => [
          ...prev,
          {
            id: messageId,
            role: 'user',
            content: finalMessage,
            timestamp: Timestamp.now(),
          },
        ]);
      }

      // ========================================================================
      // STEP 4: Call AI backend
      // ========================================================================
      console.log('🤖 Calling AI with context...');
      console.log('  - Health records:', targetRecords.length);
      console.log('  - Files attached:', files?.length || 0);
      console.log('  - Media parts:', formatted.mediaParts?.length || 0);
      console.log('📊 Context being sent:', {
        textLength: formatted.text?.length || 0,
        mediaPartsCount: formatted.mediaParts?.length || 0,
        firstMediaPart: formatted.mediaParts?.[0]
          ? {
              type: formatted.mediaParts[0].type,
              mimeType: formatted.mediaParts[0].mimeType,
              hasUrl: !!formatted.mediaParts[0].url,
              urlLength: formatted.mediaParts[0].url?.length || 0,
              urlPreview: formatted.mediaParts[0].url?.substring(0, 50),
            }
          : null,
      });

      const aiResponse = await callAIBackend(
        finalMessage,
        formatted.text,
        selectedModel,
        formatted.mediaParts
      );

      // ========================================================================
      // STEP 5: Store AI response
      // ========================================================================

      if (!activeChatId) {
        throw new Error('Chat ID is missing');
      }

      const assistantMessageId = await addEncryptedMessage(user.uid, activeChatId, {
        role: 'assistant',
        content: aiResponse,
      });

      setMessages(prev => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: aiResponse,
          timestamp: Timestamp.now(),
        },
      ]);

      console.log('✅ Message exchange complete');
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      setChatError(error instanceof Error ? error : new Error('Failed to send message'));
    } finally {
      setIsSendingMessage(false);
    }
  };

  /**
   * Extract text from scanned PDFs using OCR
   * Converts PDF pages to images and runs vision/OCR on them
   */
  async function extractTextFromPDFViaOCR(file: File): Promise<string> {
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
  }

  /**
   * Load an existing chat's messages
   */
  const handleLoadChat = async (chatId: string) => {
    if (!user) return;

    setIsLoadingMessages(true);
    setCurrentChatId(chatId);

    try {
      const chatMessages = await getEncryptedChatMessages(user.uid, chatId);
      setMessages(chatMessages);
    } catch (error) {
      console.error('❌ Failed to load chat messages:', error);
      setChatError(error instanceof Error ? error : new Error('Failed to load chat'));
    } finally {
      setIsLoadingMessages(false);
    }
  };

  /**
   * Start a new chat (clear current chat state)
   */
  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setChatError(null);
  };

  /**
   * Handle downloading an attachment
   */
  const handleDownloadAttachment = async (attachment: ContextAttachment) => {
    if (!user || !currentChatId) return;

    try {
      const { blob, fileName } = await downloadEncryptedAttachment(
        user.uid,
        currentChatId,
        attachment
      );

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('✅ Attachment downloaded:', fileName);
    } catch (error) {
      console.error('❌ Failed to download attachment:', error);
      setChatError(error instanceof Error ? error : new Error('Failed to download attachment'));
    }
  };

  // ============================================================================
  // AI BACKEND INTEGRATION
  // ============================================================================

  /**
   * Call AI backend via Firebase Cloud Function
   *
   * @param userMessage The user's message content
   * @param healthContext XML string generated by ContextFormatter.
   * @param model Selected AI model configuration.
   * @param mediaParts Optional array of images/videos for multimodal analysis
   */
  async function callAIBackend(
    userMessage: string,
    healthContext: string | null,
    model: AIModel,
    mediaParts?: MediaPart[]
  ): Promise<string> {
    console.log(`🤖 Calling AI: ${model.name} (${model.provider})`);

    try {
      // Step 1: Prepare conversation history (last 10 messages for context)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Step 2: Call Firebase Cloud Function
      const response = await fetch('https://us-central1-belrose-757fe.cloudfunctions.net/aiChat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          healthContext: healthContext,
          model: model.id,
          provider: model.provider,
          mediaParts: mediaParts,
          conversationHistory,
        }),
      });

      // Step 3: Error Handling
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const data = await response.json();

      // Step 4: Return AI's response text
      return data.response;
    } catch (error) {
      console.error('❌ AI Backend Error:', error);
      throw error instanceof Error
        ? error
        : new Error('An unexpected error occurred while connecting to the AI service.');
    }
  }

  /**
   * TODO: Optional - Generate better title using AI
   */
  async function generateAITitle(
    firstUserMessage: string,
    firstAIResponse: string
  ): Promise<string> {
    // Could call AI with prompt like:
    // "Generate a short, descriptive title (max 50 chars) for this conversation: [messages]"

    // For now, just use the simple title
    return generateChatTitle(firstUserMessage, 50);
  }

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * Get subject name for badge
   */
  const getSubjectName = () => {
    if (selectedContext.type === 'subject' && selectedContext.subjectId) {
      const subject = availableSubjects.find(s => s.id === selectedContext.subjectId);
      return subject?.firstName || 'Unknown';
    }
    return undefined;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // Loading state
  if (authLoading || loading) {
    return <LoadingView />;
  }

  // Not authenticated
  if (!user) {
    return <UnauthenticatedView />;
  }

  // Error state
  if (error) {
    return <ErrorView error={error} />;
  }

  // No records state
  if (allRecords.length === 0) {
    return <NoRecordsView />;
  }

  // Main chat interface
  return (
    <div className="relative h-full">
      {/* Drag & Drop Overlay */}
      <FileDragOverlay isDragging={isDragging} />

      <AIHealthAssistantView
        user={user}
        messages={messages}
        isLoading={isSendingMessage || isLoadingMessages}
        error={chatError}
        onSendMessage={handleSendMessage}
        onClearChat={handleNewChat}
        selectedModel={selectedModel}
        availableModels={availableModels}
        onModelChange={setSelectedModel}
        healthContext={`${selectedContext.recordCount} records selected`}
        selectedContext={selectedContext}
        onContextChange={handleContextChange}
        availableSubjects={availableSubjects}
        allRecords={allRecords}
        getSubjectName={getSubjectName}
        pendingFiles={pendingFiles}
        onPendingFilesClear={() => setPendingFiles([])}
      />
    </div>
  );
}
