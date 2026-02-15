// src/pages/AppPortal.tsx

/**
 * The main portal page for the Belrose App. This is the landing page after login and serves as the entry point for the AI Health Assistant feature.
 */

import React, { useState, useEffect } from 'react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { FileObject } from '@/types/core';
import { SubjectInfo } from '@/features/Ai/components/ui/SubjectList';
import { ContextSelection } from '@/features/Ai/components/ui/ContextBadge';
import {
  getAccessibleRecords,
  getAvailableSubjects,
} from '@/features/Ai/service/recordContextService';
import { AIModel } from '@/features/Ai/components/ui/ModelSelector';
import {
  AIHealthAssistantView,
  LoadingView,
  UnauthenticatedView,
  ErrorView,
  NoRecordsView,
} from '@/features/Ai/components/AIAssistantView';
import { AVAILABLE_MODELS } from '@/features/Ai/components/AIChat';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { useAIChat } from '@/features/Ai/hooks/useAIChat';
import { useFileDrop } from '@/hooks/useFileDrop';
import { FileDragOverlay } from '@/components/ui/FileDragOverlay';

export default function AppPortal() {
  const { user, loading: authLoading } = useAuthContext();

  // ============================================================================
  // DATA STATE
  // ============================================================================

  const [allRecords, setAllRecords] = useState<FileObject[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<SubjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ============================================================================
  // UI STATE
  // ============================================================================

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

  // Pending files from drag & drop
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // ============================================================================
  // HOOKS
  // ============================================================================

  // Drag and drop
  const { isDragging } = useFileDrop({
    onDrop: setPendingFiles,
    global: true,
  });

  // AI Chat functionality
  const chat = useAIChat({
    user,
    allRecords,
    selectedContext,
    selectedModel,
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

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleContextChange = (newContext: ContextSelection) => {
    setSelectedContext(newContext);
  };

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
        messages={chat.messages}
        isLoading={chat.isSendingMessage || chat.isLoadingMessages}
        error={chat.chatError}
        onSendMessage={chat.handleSendMessage}
        onClearChat={chat.handleNewChat}
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
