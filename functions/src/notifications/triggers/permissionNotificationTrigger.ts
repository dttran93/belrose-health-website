/**
 * Permission Change Notification Trigger
 *
 * Watches permissionChangeEvents for new documents and notifies
 * the affected user(s) about their permission change.
 *
 * Who gets notified:
 *   - The user whose permission changed (each entry in changes[])
 *
 * Who doesn't:
 *   - The person who made the change (changedBy) — they initiated it
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { defineSecret } from 'firebase-functions/params';
import {
  createNotification,
  getUserDisplayName,
  CreateNotificationInput,
} from '../notificationUtils';
import { sendEmailIfEnabled } from '../emailUtils';
import {
  buildPermissionGrantedHtml,
  buildPermissionGrantedText,
  buildPermissionRevokedHtml,
  buildPermissionRevokedText,
  buildPermissionDowngradedHtml,
  buildPermissionDowngradedText,
} from '../emails/permissionEmailTemplate';
import { PermissionChange, BlockchainRef } from '@belrose/shared';

// ============================================================================
// TYPES
// ============================================================================

interface PermissionChangeEvent {
  recordId: string;
  encryptedRecordTitle?: string;
  encryptedRecordTitleIv?: string;
  changedBy: string;
  changedAt: Timestamp;
  changes: PermissionChange[];
  blockchainRef: BlockchainRef;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const resendKey = defineSecret('RESEND_API_KEY');

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build the notification input for a single permission change.
 * Each action type maps to its own notification type and message.
 */
function buildNotificationInput(
  change: PermissionChange,
  changedByName: string,
  recordId: string,
  encryptedRecordTitle?: string,
  encryptedRecordTitleIv?: string
): CreateNotificationInput {
  const recordFallback = `Record ${recordId.slice(0, 8)}...`;
  const link = `/app/records/${recordId}`;

  const payloadBase = {
    recordId,
    changedBy: change.userId,
    ...(encryptedRecordTitle && { encryptedRecordTitle }),
    ...(encryptedRecordTitleIv && { encryptedRecordTitleIv }),
  };

  switch (change.action) {
    case 'granted':
      return {
        type: 'PERMISSIONS_GRANTED',
        message: `${changedByName} granted you ${change.newRole} access to ${recordFallback}.`,
        link,
        payload: { ...payloadBase, newRole: change.newRole },
      };
    case 'upgraded':
      return {
        type: 'PERMISSIONS_GRANTED',
        message: `${changedByName} upgraded your access to ${change.newRole} on ${recordFallback}.`,
        link,
        payload: { ...payloadBase, previousRole: change.previousRole, newRole: change.newRole },
      };
    case 'downgraded':
      return {
        type: 'PERMISSIONS_REVOKED',
        message: `${changedByName} changed your access from ${change.previousRole} to ${change.newRole} on ${recordFallback}.`,
        link,
        payload: { ...payloadBase, previousRole: change.previousRole, newRole: change.newRole },
      };
    case 'revoked':
      return {
        type: 'PERMISSIONS_REVOKED',
        message: `${changedByName} removed your ${change.previousRole} access to ${recordFallback}.`,
        link: `/app/records`, // record no longer accessible
        payload: { ...payloadBase, previousRole: change.previousRole },
      };
  }
}

// ============================================================================
// TRIGGER
// ============================================================================

export const onPermissionChangeEventCreated = onDocumentCreated(
  { document: 'permissionChangeEvents/{eventId}', secrets: [resendKey] },
  async event => {
    const eventId = event.params.eventId;
    const data = event.data?.data() as PermissionChangeEvent | undefined;

    if (!data) {
      console.log('⚠️ No data in permission change event, skipping');
      return;
    }

    if (!data.changes || data.changes.length === 0) {
      console.log('⚠️ No changes in event, skipping');
      return;
    }

    console.log(`🔑 Permission change event created: ${eventId}`);

    const changedByName = await getUserDisplayName(data.changedBy);
    const resend = new Resend(resendKey.value());

    // Process each change — notify the affected user
    await Promise.all(
      data.changes.map(async change => {
        // Don't notify the person who made the change
        if (change.userId === data.changedBy) return;

        // Build and send in-app notification
        const notificationInput = buildNotificationInput(
          change,
          changedByName,
          data.recordId,
          data.encryptedRecordTitle,
          data.encryptedRecordTitleIv
        );

        await createNotification(change.userId, notificationInput);

        // Build and send email
        const emailType =
          notificationInput.type === 'PERMISSIONS_GRANTED'
            ? 'PERMISSIONS_GRANTED'
            : 'PERMISSIONS_REVOKED';

        const { subject, html, text } = buildPermissionEmail(change, changedByName, data.recordId);

        await sendEmailIfEnabled(change.userId, emailType, { subject, html, text }, resend);
      })
    );

    console.log(`✅ Permission notifications sent for ${data.changes.length} change(s)`);
  }
);

// ============================================================================
// EMAIL DISPATCHER
// ============================================================================

/**
 * Routes to the correct email builder based on the change action.
 */
function buildPermissionEmail(
  change: PermissionChange,
  changedByName: string,
  recordId: string
): { subject: string; html: string; text: string } {
  switch (change.action) {
    case 'granted':
      return {
        subject: `${changedByName} granted you access to a record`,
        html: buildPermissionGrantedHtml(changedByName, recordId, change.newRole!, false),
        text: buildPermissionGrantedText(changedByName, recordId, change.newRole!, false),
      };
    case 'upgraded':
      return {
        subject: `Your access has been upgraded`,
        html: buildPermissionGrantedHtml(
          changedByName,
          recordId,
          change.newRole!,
          true,
          change.previousRole!
        ),
        text: buildPermissionGrantedText(
          changedByName,
          recordId,
          change.newRole!,
          true,
          change.previousRole!
        ),
      };
    case 'downgraded':
      return {
        subject: `Your access level has changed`,
        html: buildPermissionDowngradedHtml(
          changedByName,
          recordId,
          change.previousRole!,
          change.newRole!
        ),
        text: buildPermissionDowngradedText(
          changedByName,
          recordId,
          change.previousRole!,
          change.newRole!
        ),
      };
    case 'revoked':
      return {
        subject: `Your access to a record has been removed`,
        html: buildPermissionRevokedHtml(changedByName, recordId, change.previousRole!),
        text: buildPermissionRevokedText(changedByName, recordId, change.previousRole!),
      };
  }
}
