// src/pages/AppPortal.tsx

/**
 * The main portal page for the Belrose App. This is the landing page after login and serves as the entry point for the AI Health Assistant feature.
 */

import React, { useState, useEffect } from 'react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { FHIRBundle, FHIREntry } from '@/types/fhir';
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
import { DEFAULT_MODELS } from '@/features/Ai/components/AIChat';

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
  const [selectedModel, setSelectedModel] = useState<AIModel>({
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    description: 'Fast and capable',
  });

  const availableModels: AIModel[] = DEFAULT_MODELS;

  // Context state
  const [selectedContext, setSelectedContext] = useState<ContextSelection>({
    type: 'my-records',
    subjectId: null,
    recordCount: 0,
    description: 'Your health records',
  });

  // FHIR bundle for AI
  const [fhirBundle, setFhirBundle] = useState<FHIRBundle | null>(null);

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
        setAllRecords(records);

        // Get available subjects from those records
        const subjects = await getAvailableSubjects(records, user.uid);
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

  // Update FHIR bundle when context changes
  useEffect(() => {
    if (!user || allRecords.length === 0) {
      setFhirBundle(null);
      return;
    }

    // Filter records based on selected context
    let contextRecords: FileObject[] = [];

    if (selectedContext.type === 'my-records') {
      // Filter where subjects array includes current user's ID
      contextRecords = allRecords.filter(r => r.subjects?.includes(user.uid));
    } else if (selectedContext.type === 'subject' && selectedContext.subjectId) {
      const targetId = selectedContext.subjectId;

      // Filter where subjects array includes the selected subject's ID
      contextRecords = allRecords.filter(r => r.subjects?.includes(targetId));
    } else if (selectedContext.type === 'all-accessible') {
      contextRecords = allRecords;
    } else if (selectedContext.type === 'specific-records' && selectedContext.recordIds) {
      contextRecords = allRecords.filter(r => selectedContext.recordIds?.includes(r.id));
    }

    // Aggregate FHIR entries from selected records
    const allEntries: FHIREntry[] = [];
    contextRecords.forEach(record => {
      if (record.fhirData?.entry) {
        allEntries.push(...record.fhirData.entry);
      }
    });

    // Create FHIR bundle
    const bundle: FHIRBundle = {
      resourceType: 'Bundle',
      id: `context-${selectedContext.type}-${Date.now()}`,
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: allEntries.length,
      entry: allEntries,
    };

    setFhirBundle(bundle);
  }, [selectedContext, allRecords, user]);

  // Handle context change
  const handleContextChange = (newContext: ContextSelection) => {
    setSelectedContext(newContext);
  };

  // ============================================================================
  // MESSAGE HANDLERS
  // ============================================================================

  /**
   * Handle user sending a message
   * FLOW:
   * 1. If no chat exists, create new encrypted chat with auto-generated title
   * 2. Add encrypted user message
   * 3. Call AI backend to get response
   * 4. Add encrypted assistant message
   * 5. If this is the first exchange, optionally update title with better one
   */
  const handleSendMessage = async (messageContent: string) => {
    if (!user || !messageContent.trim()) return;

    setIsSendingMessage(true);
    setChatError(null);

    try {
      // Get FHIR references from current context
      const recordReferences = selectedContext.recordIds || [];
      let activeChatId = currentChatId; // Track the active chat ID

      // STEP 1: Create chat if it doesn't exist
      if (!activeChatId) {
        console.log('📝 Creating new chat...');

        // Generate initial title from first message (first 50 chars)
        const initialTitle = generateChatTitle(messageContent, 50);

        if (!selectedContext.subjectId) {
          throw new Error('Subject ID is required to create a chat');
        }

        // Build chat input, only including defined fields (otherwise Firestore will reject)
        const chatInput: CreateChatInput = {
          title: initialTitle,
          subjectId: selectedContext.subjectId,
          recordCount: selectedContext.recordCount,
        };

        // Only add optional fields if they're defined (Firestore doesn't allow undefined)
        if (selectedContext.recordIds) {
          chatInput.recordIds = selectedContext.recordIds;
        }

        const { chatId, messageId } = await createEncryptedChatWithMessage(
          user.uid,
          chatInput,
          messageContent
        );

        console.log('✅ Chat created:', chatId);
        activeChatId = chatId; // Use local variable
        setCurrentChatId(chatId); // Also update state for future messages

        // Add to local messages state
        setMessages([
          {
            id: messageId,
            role: 'user',
            content: messageContent,
            timestamp: Timestamp.now(),
          },
        ]);
      } else {
        // STEP 2: Add message to existing chat
        console.log('💬 Adding message to existing chat...');

        const messageId = await addEncryptedMessage(user.uid, activeChatId, {
          role: 'user',
          content: messageContent,
        });

        // Add to local state
        setMessages(prev => [
          ...prev,
          {
            id: messageId,
            role: 'user',
            content: messageContent,
            timestamp: Timestamp.now(),
            recordReferences,
          },
        ]);
      }

      // STEP 3: Call AI backend to get response
      const aiResponse = await callAIBackend(messageContent, fhirBundle, selectedModel);

      // STEP 4: Add AI response to chat (use activeChatId, not state!)
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

      // STEP 5: Optionally update title after first exchange
      if (messages.length === 0) {
        // This was the first message - could improve title with AI
        // For now, we'll keep the auto-generated one
        // Uncomment below to update with AI-generated title:
        // const betterTitle = await generateAITitle(messageContent, aiResponse);
        // await updateEncryptedChatTitle(user.uid, activeChatId, betterTitle);
      }
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      setChatError(error instanceof Error ? error : new Error('Failed to send message'));
    } finally {
      setIsSendingMessage(false);
    }
  };

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
   * Handle user sending a message with optional attachments
   */
  const handleSendMessageWithAttachments = async (messageContent: string, files?: File[]) => {
    if (!user || !messageContent.trim()) return;

    setIsSendingMessage(true);
    setChatError(null);

    try {
      let activeChatId = currentChatId;

      // STEP 1: Create chat if it doesn't exist
      if (!activeChatId) {
        console.log('📝 Creating new chat...');

        const initialTitle = generateChatTitle(messageContent, 50);

        if (!selectedContext.subjectId) {
          throw new Error('Subject ID is required to create a chat');
        }

        const chatInput: CreateChatInput = {
          title: initialTitle,
          subjectId: selectedContext.subjectId,
          recordCount: selectedContext.recordCount,
        };

        if (selectedContext.recordIds) {
          chatInput.recordIds = selectedContext.recordIds;
        }

        const { chatId, messageId } = await createEncryptedChatWithMessage(
          user.uid,
          chatInput,
          messageContent,
          {
            recordReferences: selectedContext.recordIds || [],
          }
        );

        console.log('✅ Chat created:', chatId);
        activeChatId = chatId;
        setCurrentChatId(chatId);

        setMessages([
          {
            id: messageId,
            role: 'user',
            content: messageContent,
            timestamp: Timestamp.now(),
            context: {
              recordReferences: selectedContext.recordIds || [],
            },
          },
        ]);
      } else {
        // STEP 2: Add message to existing chat
        console.log('💬 Adding message to existing chat...');

        // Upload attachments if any
        let attachments: ContextAttachment[] = [];
        if (files && files.length > 0) {
          console.log(`📎 Uploading ${files.length} attachments...`);
          attachments = await Promise.all(
            files.map(file => uploadEncryptedAttachment(user.uid, activeChatId!, file, 'document'))
          );
          console.log('✅ Attachments uploaded');
        }

        const messageId = await addEncryptedMessage(user.uid, activeChatId, {
          role: 'user',
          content: messageContent,
          context: {
            recordReferences: selectedContext.recordIds || [],
            attachments: attachments.length > 0 ? attachments : undefined,
          },
        });

        setMessages(prev => [
          ...prev,
          {
            id: messageId,
            role: 'user',
            content: messageContent,
            timestamp: Timestamp.now(),
            context: {
              recordReferences: selectedContext.recordIds || [],
              attachments: attachments.length > 0 ? attachments : undefined,
            },
          },
        ]);
      }

      // STEP 3: Call AI backend to get response
      const aiResponse = await callAIBackend(messageContent, fhirBundle, selectedModel);

      // STEP 4: Add AI response to chat
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
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      setChatError(error instanceof Error ? error : new Error('Failed to send message'));
    } finally {
      setIsSendingMessage(false);
    }
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
   */
  async function callAIBackend(
    userMessage: string,
    fhirBundle: FHIRBundle | null,
    model: AIModel
  ): Promise<string> {
    console.log('🤖 Calling AI backend...');
    console.log('  User message:', userMessage);
    console.log('  Model:', model.id);
    console.log('  FHIR bundle entries:', fhirBundle?.total || 0);

    try {
      // Get conversation history (last 10 messages for context)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Call Firebase Cloud Function
      const response = await fetch(
        'https://us-central1-belrose-757fe.cloudfunctions.net/aiChat', // ← UPDATE THIS URL
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            healthContext: JSON.stringify(fhirBundle, null, 2),
            model: model.id,
            provider: model.provider,
            conversationHistory,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('❌ AI backend error:', error);

      // Show user-friendly error
      if (error instanceof Error) {
        throw new Error(`AI Error: ${error.message}`);
      }
      throw new Error('Failed to connect to AI service');
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
      fhirBundle={fhirBundle}
      selectedContext={selectedContext}
      onContextChange={handleContextChange}
      availableSubjects={availableSubjects}
      allRecords={allRecords}
      getSubjectName={getSubjectName}
    />
  );
}
