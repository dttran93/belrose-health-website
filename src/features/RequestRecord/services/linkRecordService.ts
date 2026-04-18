// src/features/RequestRecord/services/linkRecordService.ts

/**
 * linkRecordService
 *
 * Fulfils a record request by linking an existing record. The two steps are:
 *
 *   1. Grant the requester a role on the record via PermissionsService.
 *      That call internally handles:
 *        - Blockchain role registration
 *        - RSA-wrapping the record DEK for the requester (SharingService)
 *        - Updating the Firestore role arrays
 *
 *   2. Mark the recordRequest document as fulfilled. Called by the provider when done adding records.
 *   2a. Deny the request --> flips status to denied with reason + optional note.
 */

import { getFirestore, doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { PermissionsService, Role } from '@/features/Permissions/services/permissionsService';
import { DenyReasonValue } from './fulfillRequestService';
import { PermissionPreparationService } from '@/features/Permissions/services/permissionPreparationService';
import { RecordRequest } from '@belrose/shared';

// ── addRecords ────────────────────────────────────────────────────────────────

export interface AddRecordsResult {
  success: true;
  recordIds: string[];
}

/**
 * Prepare all selected records (smart account + blockchain initialization),
 * then grant the requester a role across all of them in a single blockchain
 * transaction via grantRoleBatch.
 *
 * Preparation is sequential per-record (avoids nonce conflicts on the admin
 * wallet used by initializeRoleOnChain). The blockchain grant and subsequent
 * encryption/Firestore updates happen as a single tx + parallel off-chain work.
 */
export async function addRecordsToRequest(
  recordIds: string[],
  request: RecordRequest,
  role: Role
): Promise<AddRecordsResult> {
  if (recordIds.length === 0) throw new Error('No records selected');

  // Step 1: Prepare — smart account setup + per-record blockchain initialization
  // prepareBatch checks each record's initialRole from Firestore (owner vs admin)
  console.log(`🔄 Preparing ${recordIds.length} record(s) for linking…`);
  await PermissionPreparationService.prepareBatch(recordIds);
  console.log('✅ All records prepared');

  // Step 2: Grant role — single blockchain tx, parallel encryption + Firestore
  const succeededIds = await PermissionsService.grantRoleBatch(
    recordIds,
    request.requesterId,
    recordIds.map(() => role)
  );
  console.log(`✅ Role '${role}' granted on ${succeededIds.length} record(s)`);

  // Step 3: Register linked record IDs on the request document
  const db = getFirestore();
  await updateDoc(doc(db, 'recordRequests', request.inviteCode), {
    fulfilledRecordIds: arrayUnion(...recordIds),
  });
  console.log('✅ fulfilledRecordIds updated:', request.inviteCode);

  return { success: true, recordIds: succeededIds };
}

// ── markComplete ──────────────────────────────────────────────────────────────

export async function markRequestComplete(request: RecordRequest): Promise<void> {
  const db = getFirestore();
  await updateDoc(doc(db, 'recordRequests', request.inviteCode), {
    status: 'fulfilled',
    fulfilledAt: serverTimestamp(),
  });
  console.log('✅ Request marked fulfilled:', request.inviteCode);
}

// ── denyRequest ───────────────────────────────────────────────────────────────

export interface DenyRequestParams {
  request: RecordRequest;
  reason: DenyReasonValue;
  note?: string;
}

export async function denyRequest({ request, reason, note }: DenyRequestParams): Promise<void> {
  const db = getFirestore();
  await updateDoc(doc(db, 'recordRequests', request.inviteCode), {
    status: 'denied',
    deniedAt: serverTimestamp(),
    deniedReason: reason,
    ...(note?.trim() ? { deniedNote: note.trim() } : {}),
  });
  console.log('✅ Request denied:', request.inviteCode, reason);
}
