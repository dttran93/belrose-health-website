// src/pages/AIHealthAssistant.tsx

import React, { useState, useEffect } from 'react';
import { MessageSquare, Sparkles, Shield, X, Loader2 } from 'lucide-react';
import { AIChat } from '@/features/Ai/components/AIChat';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { FHIRBundle, FHIREntry } from '@/types/fhir';
import { FileObject } from '@/types/core';
import { SubjectInfo } from '@/features/Ai/components/ui/SubjectList';
import { ContextBadge, ContextSelection } from '@/features/Ai/components/ui/ContextBadge';
import {
  getAccessibleRecords,
  getAvailableSubjects,
} from '@/features/Ai/service/recordContextService';
import { ContextSelector } from '@/features/Ai/components/ui/ContextSelector';

const MOCK_MESSAGES_ENABLED = true; // Toggle this to test with/without messages

export default function AIHealthAssistant() {
  const { user, loading: authLoading } = useAuthContext();

  // Data state
  const [allRecords, setAllRecords] = useState<FileObject[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<SubjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMessages, setHasMessages] = useState(MOCK_MESSAGES_ENABLED);

  // Context state
  const [selectedContext, setSelectedContext] = useState<ContextSelection>({
    type: 'my-records',
    subjectId: null,
    recordCount: 0,
    description: 'Your health records',
  });

  // FHIR bundle for AI
  const [fhirBundle, setFhirBundle] = useState<FHIRBundle | null>(null);

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

  // Get subject name for badge
  const getSubjectName = () => {
    if (selectedContext.type === 'subject' && selectedContext.subjectId) {
      const subject = availableSubjects.find(s => s.id === selectedContext.subjectId);
      return subject?.firstName || 'Unknown';
    }
    return undefined;
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your health records...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to access your AI Health Assistant.</p>
          <a
            href="/auth"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <X className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Records</h2>
          <p className="text-gray-600 mb-6">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No records state
  if (allRecords.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="rounded-xl shadow-sm border p-12 text-center">
            <div className="max-w-md mx-auto">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Health Records Yet</h3>
              <p className="text-gray-600 mb-6">
                Upload your first health record to start chatting with your AI assistant.
              </p>

              <a
                href="/add-record"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Your First Record
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If chat has started (has messages), show full-screen chat
  if (hasMessages) {
    return (
      <AIChat
        fhirBundle={fhirBundle}
        className="h-full max-w-4xl mx-auto"
        contextInfo={{
          type: selectedContext.type,
          subjectName: getSubjectName(),
        }}
        leftFooterContent={
          <div className="flex items-center gap-3">
            <ContextSelector
              currentUserId={user.uid}
              availableSubjects={availableSubjects}
              allRecords={allRecords}
              selectedContext={selectedContext}
              onContextChange={handleContextChange}
            />
          </div>
        }
        onMessagesChange={messageCount => setHasMessages(messageCount > 0)}
      />
    );
  }

  // Default: Show welcome page with info cards
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* AI Chat with Empty State */}
        <div className="rounded-xl">
          <AIChat
            fhirBundle={fhirBundle}
            className=""
            contextInfo={{
              type: selectedContext.type,
              subjectName: getSubjectName(),
            }}
            leftFooterContent={
              <div className="flex items-center gap-3">
                <ContextSelector
                  currentUserId={user.uid}
                  availableSubjects={availableSubjects}
                  allRecords={allRecords}
                  selectedContext={selectedContext}
                  onContextChange={handleContextChange}
                />
              </div>
            }
            emptyStateContent={
              <div className="w-full max-w-3xl py-12">
                {/* Welcome Header */}
                <div className="text-center mb-12">
                  <h1 className="text-4xl font-bold text-gray-900 mb-3">
                    Welcome back, {user.displayName || 'there'}
                  </h1>
                  <p className="text-lg text-gray-600">Ask me anything about your health records</p>
                </div>
              </div>
            }
            onMessagesChange={messageCount => setHasMessages(messageCount > 0)}
          />
        </div>

        {/* Info Cards - Only visible when no messages */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 text-sm">Private & Secure</h4>
                <p className="text-xs text-gray-600 mt-1">
                  Your health data is encrypted and never used for AI training
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 text-sm">Context-Aware</h4>
                <p className="text-xs text-gray-600 mt-1">
                  Switch between different record contexts for precise answers
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 text-sm">Natural Language</h4>
                <p className="text-xs text-gray-600 mt-1">
                  Ask questions in plain English, just like talking to a doctor
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
