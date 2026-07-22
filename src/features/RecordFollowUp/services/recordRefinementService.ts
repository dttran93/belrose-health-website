// src/features/RecordRefinement/services/recordRefinementService.ts

/**
 * Sends a plain-English edit request to the refineRecord Cloud Function.
 * Record is passed in already decrypted from the edit screen.
 * Encryption of the result is handled by applyUpdates in useRecordEdit.
 */

import { FileObject } from '@/types/core';
import type { RefinementAIResponse } from '../types';

const REFINEMENT_ENDPOINT = 'https://us-central1-belrose-757fe.cloudfunctions.net/refineRecord';

export async function editRecord(
  record: FileObject,
  userRequest: string
): Promise<RefinementAIResponse> {
  const response = await fetch(REFINEMENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fhirData: record.fhirData,
      belroseFields: record.belroseFields,
      userRequest,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Edit API error: ${response.status} — ${errorBody.error}`);
  }

  return response.json();
}
