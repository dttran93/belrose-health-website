/**
 * useRecordRefinement
 *
 * Passive hook — call startRefinement() to trigger.
 * Uses the existing encrypted chat infrastructure to store the
 * conversation history, with chatType: 'record_refinement' to
 * distinguish from regular AI chats.
 *
 * Can be used from AddRecord, the edit flow, or anywhere a firestoreId
 * is available. Knows nothing about how the record got there.
 */

import { useState, useCallback } from 'react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import {
  createEncryptedChatWithMessage,
  addEncryptedMessage,
} from '@/features/Ai/service/encryptedChatService';
import { getDoc, doc, getFirestore, updateDoc } from 'firebase/firestore';
import {
  RefinementAIResponse,
  RefinementAnswer,
  RefinementQuestion,
  RefinementStatus,
} from '../types';
import { recordRefinementService } from '../services/recordRefinementService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { arrayBufferToBase64 } from '@/utils/dataFormattingUtils';

export interface UseRecordRefinementReturn {
  status: RefinementStatus;
  questions: RefinementQuestion[];
  chatId: string | null; // exposed so UI can link to the chat if needed
  startRefinement: () => Promise<void>;
  submitAnswers: (answers: RefinementAnswer[]) => Promise<void>;
  skipRefinement: () => Promise<void>;
  error: string | null;
}

export function useRecordRefinement(firestoreId: string | null): UseRecordRefinementReturn {
  const { user } = useAuthContext();
  const [status, setStatus] = useState<RefinementStatus>('idle');
  const [questions, setQuestions] = useState<RefinementQuestion[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startRefinement = useCallback(async () => {
    if (!firestoreId || !user) return;

    setStatus('analyzing');
    setError(null);

    try {
      // First AI turn — analyze the record
      const aiResponse = await recordRefinementService.analyze(firestoreId, user.uid);

      // Create a refinement chat to store the history
      const { chatId: newChatId } = await createEncryptedChatWithMessage(
        user.uid,
        {
          title: `Refinement: ${aiResponse.recordTitle || firestoreId}`,
          userId: user.uid,
          recordIds: [firestoreId],
          recordCount: 1,
          chatType: 'record_refinement',
        },
        // Store the AI's first response as the opening assistant message
        JSON.stringify(aiResponse)
      );

      setChatId(newChatId);

      if (aiResponse.status === 'complete') {
        // No questions — apply updates and mark done
        await applyUpdates(firestoreId, aiResponse, newChatId);
        setStatus('complete');
      } else {
        setQuestions(aiResponse.questions);
        setStatus('needs_review');
      }
    } catch (err: any) {
      setError(err.message || 'Refinement failed');
      setStatus('error');
    }
  }, [firestoreId, user]);

  const submitAnswers = useCallback(
    async (answers: RefinementAnswer[]) => {
      if (!firestoreId || !user || !chatId) return;

      setStatus('analyzing');

      try {
        // Store user answers in the chat
        await addEncryptedMessage(user.uid, chatId, {
          role: 'user',
          content: JSON.stringify(answers),
        });

        // Second AI turn — send answers, get corrected record back
        const aiResponse = await recordRefinementService.refine(
          firestoreId,
          answers,
          chatId,
          user.uid
        );

        // Store AI response
        await addEncryptedMessage(user.uid, chatId, {
          role: 'assistant',
          content: JSON.stringify(aiResponse),
        });

        await applyUpdates(firestoreId, aiResponse, chatId);
        setQuestions([]);
        setStatus('complete');
      } catch (err: any) {
        setError(err.message || 'Failed to process answers');
        setStatus('error');
      }
    },
    [firestoreId, user, chatId]
  );

  const skipRefinement = useCallback(async () => {
    setQuestions([]);
    setStatus('complete');
  }, []);

  return { status, questions, chatId, startRefinement, submitAnswers, skipRefinement, error };
}

async function applyUpdates(firestoreId: string, aiResponse: RefinementAIResponse, chatId: string) {
  const db = getFirestore();
  const updates: any = { refinementChatId: chatId };

  // Only encrypt and write fields the AI actually changed
  if (aiResponse.updatedFhirData || aiResponse.updatedBelroseFields) {
    const masterKey = await EncryptionKeyManager.getSessionKey();
    if (!masterKey) throw new Error('No encryption session active');

    // Unwrap the record's file key — handles creator, shared user, and guest paths
    const fileKey = await RecordDecryptionService.getRecordKey(firestoreId, masterKey);

    if (aiResponse.updatedFhirData) {
      const encrypted = await EncryptionService.encryptJSON(aiResponse.updatedFhirData, fileKey);
      updates.encryptedFhirData = {
        encrypted: arrayBufferToBase64(encrypted.encrypted),
        iv: arrayBufferToBase64(encrypted.iv),
      };
    }

    if (aiResponse.updatedBelroseFields) {
      const encrypted = await EncryptionService.encryptJSON(
        aiResponse.updatedBelroseFields,
        fileKey
      );
      updates.encryptedBelroseFields = {
        encrypted: arrayBufferToBase64(encrypted.encrypted),
        iv: arrayBufferToBase64(encrypted.iv),
      };
    }
  }

  await updateDoc(doc(db, 'records', firestoreId), updates);
}
