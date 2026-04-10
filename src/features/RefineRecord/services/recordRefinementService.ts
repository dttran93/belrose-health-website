// src/features/RecordRefinement/services/recordRefinementService.ts

/**
 * Handles the AI calls for record refinement.
 * Two methods:
 *   analyze() — first turn, inspects the record and decides if questions are needed
 *   refine()  — second turn, takes answers and returns corrected record data
 *
 * Decrypts record data before sending to AI.
 * Returns plaintext corrected data — the hook is responsible for re-encrypting
 * before writing back to Firestore.
 */

import { getDoc, doc, getFirestore } from 'firebase/firestore';
import { getEncryptedChatMessages } from '@/features/Ai/service/encryptedChatService';
import { FileObject } from '@/types/core';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { RefinementAIResponse, RefinementAnswer } from '../types';
import {
  getRecordReviewStatus,
  RecordReviewStatus,
} from '@/features/Credibility/services/recordReviewStatusService';

const REFINEMENT_ENDPOINT = 'https://us-central1-belrose-757fe.cloudfunctions.net/refineRecord';

/**
 * Fetches and decrypts the relevant fields from a record document.
 *
 * Encrypted fields: fhirData, belroseFields, extractedText, originalText, contextText
 * Plain fields: subjects (array of user IDs — never encrypted, used for access control)
 *
 * isSubjectSelf: true if the record is about the current user (subjects is empty
 * or contains their uid). Passed to the AI so it can phrase questions appropriately
 * ("you mentioned" vs "the patient mentioned").
 */
async function getDecryptedRecordData(
  firestoreId: string,
  userId: string
): Promise<{
  fhirData: any;
  belroseFields: any;
  extractedText: string | null;
  originalText: string | null;
  contextText: string | null;
  isSubjectSelf: boolean;
  hasSubjects: boolean;
  reviewStatus: RecordReviewStatus;
  title: string;
}> {
  const db = getFirestore();
  const snap = await getDoc(doc(db, 'records', firestoreId));
  if (!snap.exists()) throw new Error('Record not found');

  const data = snap.data();

  // Use the existing decryption service — handles creator, shared user,
  // and guest paths automatically. No need to manage keys here.
  const decrypted = await RecordDecryptionService.decryptRecord({
    id: firestoreId,
    ...data,
  } as FileObject);

  const subjects: string[] = data.subjects || [];
  const isSubjectSelf = subjects.length === 0 || subjects.includes(userId);
  const hasSubjects = subjects.length > 0;

  const currentRecordHash = data.recordHash as string | undefined;

  const reviewStatus = await getRecordReviewStatus(firestoreId, currentRecordHash, userId);

  return {
    fhirData: decrypted.fhirData ?? null,
    belroseFields: decrypted.belroseFields ?? null,
    extractedText: decrypted.extractedText ?? null,
    originalText: decrypted.originalText ?? null,
    contextText: decrypted.contextText ?? null,
    isSubjectSelf,
    hasSubjects,
    reviewStatus,
    title: decrypted.belroseFields?.title || firestoreId,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * First turn — analyze the record and decide if questions are needed.
 */
async function analyze(firestoreId: string, userId: string): Promise<RefinementAIResponse> {
  const record = await getDecryptedRecordData(firestoreId, userId);

  const response = await fetch(REFINEMENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      turn: 'analyze',
      fhirData: record.fhirData,
      belroseFields: record.belroseFields,
      extractedText: record.extractedText,
      originalText: record.originalText,
      contextText: record.contextText,
      isSubjectSelf: record.isSubjectSelf,
      hasSubjects: record.hasSubjects,
      reviewStatus: record.reviewStatus,
    }),
  });

  if (!response.ok) {
    throw new Error(`Refinement API error: ${response.status}`);
  }

  const aiResponse = await response.json();

  return { ...aiResponse, recordTitle: record.title };
}

/**
 * Second turn — send answers back with full conversation history,
 * get corrected record data back.
 */
async function refine(
  firestoreId: string,
  answers: RefinementAnswer[],
  chatId: string,
  userId: string
): Promise<RefinementAIResponse> {
  const [record, messages] = await Promise.all([
    getDecryptedRecordData(firestoreId, userId),
    getEncryptedChatMessages(userId, chatId),
  ]);

  // Reconstruct conversation history for the AI.
  // Messages are stored as stringified JSON so parse them back —
  // fall back to raw string if parsing fails (e.g. a plain text message)
  const history = messages.map(m => ({
    role: m.role,
    content: (() => {
      try {
        return JSON.parse(m.content);
      } catch {
        return m.content;
      }
    })(),
  }));

  const response = await fetch(REFINEMENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      turn: 'refine',
      fhirData: record.fhirData,
      belroseFields: record.belroseFields,
      extractedText: record.extractedText,
      originalText: record.originalText,
      contextText: record.contextText,
      isSubjectSelf: record.isSubjectSelf,
      history,
      answers,
    }),
  });

  if (!response.ok) {
    throw new Error(`Refinement API error: ${response.status}`);
  }

  return response.json();
}

export const recordRefinementService = { analyze, refine };
