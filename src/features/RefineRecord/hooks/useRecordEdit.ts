// src/features/RecordRefinement/hooks/useRecordEdit.ts

/**
 * Hook for AI-assisted record editing from the ViewEditRecord screen.
 * Takes a decrypted FileObject directly — no Firestore fetch needed.
 * Single turn: user request → corrected FHIR/belroseFields.
 * Caller is responsible for saving — this hook only populates the editor.
 */

import { useState, useCallback } from 'react';
import { FileObject } from '@/types/core';
import type { RefinementAIResponse } from '../types';
import { editRecord } from '../services/recordRefinementService';

export interface UseRecordEditReturn {
  isLoading: boolean;
  error: string | null;
  lastResponse: RefinementAIResponse | null;
  sendEditRequest: (userRequest: string) => Promise<void>;
  clearError: () => void;
}

export function useRecordEdit(
  record: FileObject,
  onUpdated: (updatedFhirData: any, updatedBelroseFields: any) => void
): UseRecordEditReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<RefinementAIResponse | null>(null);

  const sendEditRequest = useCallback(
    async (userRequest: string) => {
      if (!userRequest.trim()) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await editRecord(record, userRequest);
        setLastResponse(response);

        if (response.updatedFhirData || response.updatedBelroseFields) {
          onUpdated(
            response.updatedFhirData ?? record.fhirData,
            response.updatedBelroseFields ?? record.belroseFields
          );
        }
      } catch (err: any) {
        setError(err.message || 'Edit request failed');
      } finally {
        setIsLoading(false);
      }
    },
    [record, onUpdated]
  );

  const clearError = useCallback(() => setError(null), []);

  return { isLoading, error, lastResponse, sendEditRequest, clearError };
}
