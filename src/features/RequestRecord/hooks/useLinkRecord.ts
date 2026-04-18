// src/features/RequestRecord/hooks/useLinkRecord.ts

/**
 * useLinkRecord
 *
 * Drives the LinkRecordModal. Phases:
 *
 *   pick-records  — multi-select from accessible records
 *   pick-role     — choose Viewer / Admin / Owner for all selected records
 *   confirm-deny  — select deny reason + optional note
 *   executing     — async in flight (prepareBatch + grantRoleBatch happen here)
 *   error         — something failed, can retry or cancel
 *
 * All blockchain preparation and batch-grant logic lives in linkRecordService
 * (which delegates to PermissionPreparationService + PermissionsService).
 * This hook only manages UI state.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { getAccessibleRecords } from '@/features/Ai/service/recordContextService';
import { FileObject } from '@/types/core';
import { Role } from '@/features/Permissions/services/permissionsService';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import {
  addRecordsToRequest,
  markRequestComplete,
  denyRequest,
} from '../services/linkRecordService';
import { DenyReasonValue } from '../services/fulfillRequestService';
import { RecordRequest } from '@belrose/shared';

export type LinkPhase = 'pick-records' | 'pick-role' | 'confirm-deny' | 'executing' | 'error';

interface UseLinkRecordReturn {
  // Records
  records: FileObject[];
  recordsLoading: boolean;

  // Selection
  selectedIds: string[];
  toggleRecord: (id: string) => void;
  /** Replace the entire selection at once — used by RecordPickerContent */
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;

  // Role
  selectedRole: Role;
  setSelectedRole: (r: Role) => void;

  // Deny
  denyReason: DenyReasonValue | '';
  setDenyReason: (r: DenyReasonValue) => void;
  denyNote: string;
  setDenyNote: (n: string) => void;

  // Phase
  phase: LinkPhase;
  error: string | null;

  // Linked so far in this session (for the "X records linked" counter)
  linkedThisSession: string[];

  // Actions
  goToRolePicker: () => void;
  goBackToRecordPicker: () => void;
  goToDenyConfirm: () => void;
  goBackFromDeny: () => void;
  submitAddRecords: () => Promise<void>;
  submitMarkComplete: () => Promise<void>;
  submitDeny: () => Promise<void>;
  reset: () => void;
}

export function useLinkRecord(
  request: RecordRequest | null,
  onClose: () => void
): UseLinkRecordReturn {
  const { user } = useAuthContext();

  const [records, setRecords] = useState<FileObject[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role>('viewer');
  const [denyReason, setDenyReason] = useState<DenyReasonValue | ''>('');
  const [denyNote, setDenyNote] = useState('');
  const [phase, setPhase] = useState<LinkPhase>('pick-records');
  const [error, setError] = useState<string | null>(null);
  const [linkedThisSession, setLinkedThisSession] = useState<string[]>([]);

  // Fetch + decrypt records when modal opens
  useEffect(() => {
    if (!request || !user?.uid) return;

    setRecordsLoading(true);
    getAccessibleRecords(user.uid)
      .then(async recs => {
        const decrypted = await RecordDecryptionService.decryptRecords(recs as any);
        const sorted = [...decrypted].sort((a, b) => {
          const ms = (r: FileObject) => {
            const t = r.uploadedAt;
            if (!t) return 0;
            if (typeof (t as any).toMillis === 'function') return (t as any).toMillis();
            return new Date(t as any).getTime();
          };
          return ms(b) - ms(a);
        });
        setRecords(sorted as FileObject[]);
      })
      .catch(() => setError('Failed to load your records. Please try again.'))
      .finally(() => setRecordsLoading(false));
  }, [request?.inviteCode, user?.uid]);

  const toggleRecord = useCallback((id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const goToRolePicker = useCallback(() => {
    if (selectedIds.length === 0) return;
    setPhase('pick-role');
  }, [selectedIds]);

  const goBackToRecordPicker = useCallback(() => {
    setPhase('pick-records');
    setError(null);
  }, []);

  const goToDenyConfirm = useCallback(() => {
    setPhase('confirm-deny');
    setError(null);
  }, []);

  const goBackFromDeny = useCallback(() => {
    setPhase('pick-records');
    setError(null);
  }, []);

  const submitAddRecords = useCallback(async () => {
    if (!request || selectedIds.length === 0) return;
    setPhase('executing');
    setError(null);
    try {
      const result = await addRecordsToRequest(selectedIds, request, selectedRole);
      setLinkedThisSession(prev => [...new Set([...prev, ...result.recordIds])]);
      setSelectedIds([]);
      setSelectedRole('viewer');
      setPhase('pick-records');
    } catch (err: any) {
      setError(err.message || 'Failed to link records. Please try again.');
      setPhase('error');
    }
  }, [request, selectedIds, selectedRole]);

  const submitMarkComplete = useCallback(async () => {
    if (!request) return;
    setPhase('executing');
    setError(null);
    try {
      await markRequestComplete(request);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to mark request complete.');
      setPhase('error');
    }
  }, [request, onClose]);

  const submitDeny = useCallback(async () => {
    if (!request || !denyReason) return;
    setPhase('executing');
    setError(null);
    try {
      await denyRequest({ request, reason: denyReason, note: denyNote });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to deny request.');
      setPhase('error');
    }
  }, [request, denyReason, denyNote, onClose]);

  const reset = useCallback(() => {
    setSelectedIds([]);
    setSelectedRole('viewer');
    setDenyReason('');
    setDenyNote('');
    setPhase('pick-records');
    setError(null);
    setLinkedThisSession([]);
    setRecords([]);
  }, []);

  return {
    records,
    recordsLoading,
    selectedIds,
    toggleRecord,
    setSelectedIds,
    clearSelection,
    selectedRole,
    setSelectedRole,
    denyReason,
    setDenyReason,
    denyNote,
    setDenyNote,
    phase,
    error,
    linkedThisSession,
    goToRolePicker,
    goBackToRecordPicker,
    goToDenyConfirm,
    goBackFromDeny,
    submitAddRecords,
    submitMarkComplete,
    submitDeny,
    reset,
  };
}
