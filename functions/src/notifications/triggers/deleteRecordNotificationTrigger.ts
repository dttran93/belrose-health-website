// functions/src/notifications/triggers/deleteRecordNotificationTrigger.ts

/**
 * Record Deletion Notification Triggers
 *
 * Firestore triggers that watch the recordDeletionEvents collection and
 * automatically create notifications for affected users.
 *
 * Two triggers:
 * 1. onRecordDeletionEventCreated - watches recordDeletionEvents collection
 *    - Notifies all affected users (owners, admins, viewers) that the record was deleted
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { createNotificationForMultiple, getUserDisplayName } from '../notificationUtils';
import { Resend } from 'resend';
import { resendKey, sendEmailIfEnabled } from '../emailUtils';
import {
  buildRecordDeletedHtml,
  buildRecordDeletedText,
} from '../emails/recordDeletionEmailTemplates';
import { RecordDeletionEvent } from '@/_shared';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Collect all unique user IDs who should be notified about a deletion,
 * excluding the user who performed the deletion.
 */
function getAffectedUserIds(event: RecordDeletionEvent): string[] {
  const { owners, administrators, viewers, subjects } = event.affectedUsers;
  const all = [...owners, ...administrators, ...viewers, ...subjects];
  // Deduplicate and exclude the deleter (they don't need to notify themselves)
  return [...new Set(all)].filter(id => id !== event.deletedBy);
}

// ============================================================================
// TRIGGER 1: DELETION EVENT CREATED
// ============================================================================

/**
 * Triggered when a recordDeletionEvent document is created.
 *
 * This fires as soon as RecordDeletionService writes the event — before
 * the actual Firebase deletion completes — so notifications go out promptly.
 * All affected users (admins, viewers) are notified that the record was deleted.
 */
export const onRecordDeletionEventCreated = onDocumentCreated(
  'recordDeletionEvents/{recordId}',
  async event => {
    const recordId = event.params.recordId;
    const data = event.data?.data() as RecordDeletionEvent | undefined;

    if (!data) {
      console.log('⚠️ No data in created deletion event, skipping');
      return;
    }

    console.log(`🗑️ Record deletion event created: ${recordId}`);

    const affectedUserIds = getAffectedUserIds(data);

    if (affectedUserIds.length === 0) {
      console.log('ℹ️ No other users affected, skipping notifications');
      return;
    }

    const deleterName = await getUserDisplayName(data.deletedBy);
    const recordName = `Record ${recordId.slice(0, 8)}...`;

    await createNotificationForMultiple(affectedUserIds, {
      type: 'RECORD_DELETED',
      message: `${deleterName} has permanently deleted the record: ${recordName}. You no longer have access to this record.`,
      link: `/app/records`,
      payload: {
        recordId,
        deletedBy: data.deletedBy,
      },
    });

    const resend = new Resend(resendKey.value());
    await Promise.all(
      affectedUserIds.map(uid =>
        sendEmailIfEnabled(
          uid,
          'RECORD_DELETED',
          {
            subject: `${deleterName} deleted a record you had access to`,
            html: buildRecordDeletedHtml(deleterName, recordName),
            text: buildRecordDeletedText(deleterName, recordName),
          },
          resend
        )
      )
    );

    console.log(
      `✅ Deletion notifications sent to ${affectedUserIds.length} user(s) for record: ${recordId}`
    );
  }
);
