// functions/src/notifications/triggers/subjectNotificationTrigger.ts

/**
 * Subject Notification Triggers
 *
 * Firestore triggers that watch for subject-related changes and
 * automatically create notifications.
 *
 * Two triggers:
 * 1. onSubjectConsentRequestCreated - watches subjectConsentRequests collection
 *    - New consent requests (notifies proposed subject)
 *
 * 2. onSubjectConsentRequestUpdated - watches subjectConsentRequests collection
 *    - Accepted requests (notifies requester)
 *    - Rejected requests (notifies requester)
 * - Subject removals after acceptance (notifies record owners/creators)
 * - Creator responses to rejections (notifies subject)
 */

import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import {
  createNotification,
  createNotificationForMultiple,
  getUserDisplayName,
  getRecordDisplayName,
  NotificationType,
} from '../notificationUtils';
import { defineSecret } from 'firebase-functions/params';
import { sendEmailIfEnabled } from '../emailUtils';
import { Resend } from 'resend';
import {
  buildCreatorResponseHtml,
  buildCreatorResponseText,
  buildSubjectAcceptedHtml,
  buildSubjectAcceptedText,
  buildSubjectDeclinedHtml,
  buildSubjectDeclinedText,
  buildSubjectRemovedHtml,
  buildSubjectRemovedText,
  buildSubjectRequestHtml,
  buildSubjectRequestText,
} from '../emails/subjectEmailTemplates';

// ============================================================================
// TYPES
// ============================================================================

export type SubjectRejectionType = 'request_rejected' | 'removed_after_acceptance';
type CreatorResponseStatus = 'pending_creator_decision' | 'acknowledged' | 'escalated';

/**
 * Creator's response to a subject rejection
 */
interface CreatorResponse {
  status: CreatorResponseStatus;
  respondedAt?: Timestamp;
  publiclyListed: boolean;
}

/**
 * Rejection data - nested within SubjectConsentRequest
 */
interface SubjectRejectionData {
  rejectionType: SubjectRejectionType;
  rejectedAt: Timestamp;
  reason?: string;
  rejectionSignature?: string;
  creatorResponse?: CreatorResponse;
}

/**
 * Document structure for subjectConsentRequests collection
 */
interface SubjectConsentRequest {
  recordId: string;
  subjectId: string;
  requestedBy: string;
  requestedSubjectRole: 'viewer' | 'administrator' | 'owner';
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
  respondedAt?: Timestamp;
  recordTitle?: string;
  grantedAccessOnSubjectRequest: boolean;
  rejection?: SubjectRejectionData;
}

interface RecordForNotification {
  uploadedBy?: string;
  owners?: string[];
  administrators: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const resendKey = defineSecret('RESEND_API_KEY');
const resend = new Resend(resendKey.value());

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get record data from Firestore
 */
async function getRecordData(recordId: string): Promise<RecordForNotification | null> {
  const db = getFirestore();
  const recordDoc = await db.collection('records').doc(recordId).get();

  if (!recordDoc.exists) {
    console.log(`⚠️ Record ${recordId} not found`);
    return null;
  }

  return recordDoc.data() as RecordForNotification;
}

/**
 * Get all users who should be notified about record changes
 * (uploader + owners, deduplicated)
 */
function getRecordNotificationTargets(record: RecordForNotification): string[] {
  const targets: string[] = [];

  if (record.uploadedBy) {
    targets.push(record.uploadedBy);
  }

  if (record.owners) {
    targets.push(...record.owners);
  }

  return [...new Set(targets)];
}

/**
 * Check if rejection data was newly added
 */
function isNewRejection(before: SubjectConsentRequest, after: SubjectConsentRequest): boolean {
  return !before.rejection && !!after.rejection;
}

/**
 * Check if creator response status changed from pending to resolved
 */
function isNewCreatorResponse(
  before: SubjectConsentRequest,
  after: SubjectConsentRequest
): boolean {
  const beforeStatus = before.rejection?.creatorResponse?.status;
  const afterStatus = after.rejection?.creatorResponse?.status;

  return (
    beforeStatus === 'pending_creator_decision' &&
    (afterStatus === 'acknowledged' || afterStatus === 'escalated')
  );
}

// ============================================================================
// TRIGGER 1: NEW CONSENT REQUEST CREATED
// ============================================================================

/**
 * Triggered when a new consent request document is created.
 * Notifies the proposed subject that someone wants them to be a subject.
 */
export const onSubjectConsentRequestCreated = onDocumentCreated(
  { document: 'subjectConsentRequests/{requestId}', secrets: [resendKey] },
  async event => {
    const requestId = event.params.requestId;
    const data = event.data?.data() as SubjectConsentRequest | undefined;

    if (!data) {
      console.log('⚠️ No data in created document, skipping');
      return;
    }

    console.log(`📬 New consent request created: ${requestId}`);

    // Only notify for pending requests (should always be pending on create)
    if (data.status !== 'pending') {
      console.log(`⚠️ Request status is ${data.status}, not pending. Skipping notification.`);
      return;
    }

    const requesterName = await getUserDisplayName(data.requestedBy);
    const recordName = data.recordTitle || (await getRecordDisplayName(data.recordId));

    await createNotification(data.subjectId, {
      type: 'SUBJECT_REQUEST_RECEIVED',
      message: `${requesterName} has requested to set you as the subject of record: ${recordName}. Please review and respond.`,
      link: `/app/records/${data.recordId}/review-subject-request`,
      payload: {
        recordId: data.recordId,
        requestId,
        subjectId: data.subjectId,
        requestedBy: data.requestedBy,
        requestedSubjectRole: data.requestedSubjectRole,
      },
    });

    await sendEmailIfEnabled(
      data.subjectId,
      'SUBJECT_REQUEST_RECEIVED',
      {
        subject: `${requesterName} wants to add you as a subject`,
        html: buildSubjectRequestHtml(requesterName, recordName, data.recordId),
        text: buildSubjectRequestText(requesterName, recordName, data.recordId),
      },
      resend
    );

    console.log(`✅ Notification sent to subject: ${data.subjectId}`);
  }
);

// ============================================================================
// TRIGGER 2: CONSENT REQUEST UPDATED
// ============================================================================

/**
 * Triggered when a consent request document is updated.
 *
 * Handles:
 * 1. Status changes: pending → accepted/rejected
 * 2. Rejection data added (subject removed themselves after accepting)
 * 3. Creator response to rejection
 */
export const onSubjectConsentRequestUpdated = onDocumentUpdated(
  'subjectConsentRequests/{requestId}',
  async event => {
    const requestId = event.params.requestId;
    const beforeData = event.data?.before.data() as SubjectConsentRequest | undefined;
    const afterData = event.data?.after.data() as SubjectConsentRequest | undefined;

    if (!beforeData || !afterData) {
      console.log('⚠️ No data to compare, skipping');
      return;
    }

    console.log(`🔄 Consent request ${requestId} updated`);

    const recordName = afterData.recordTitle || (await getRecordDisplayName(afterData.recordId));
    const recordId = afterData.recordId;
    const subjectName = await getUserDisplayName(afterData.subjectId);

    // ========================================================================
    // TRIGGER 2a: Request Accepted: Status changed from pending → accepted
    // ========================================================================
    if (beforeData.status === 'pending' && afterData.status === 'accepted') {
      console.log(`✅ Request accepted: ${requestId}`);

      await createNotification(afterData.requestedBy, {
        type: 'SUBJECT_ACCEPTED',
        message: `${subjectName} has accepted your subject request for the record: ${recordName}.`,
        link: `/app/records/${afterData.recordId}`,
        payload: {
          recordId: afterData.recordId,
          requestId,
          subjectId: afterData.subjectId,
        },
      });

      await sendEmailIfEnabled(
        afterData.requestedBy,
        'SUBJECT_ACCEPTED',
        {
          subject: `${subjectName} accepted your subject request`,
          html: buildSubjectAcceptedHtml(subjectName, recordName, recordId),
          text: buildSubjectAcceptedText(subjectName, recordName, recordId),
        },
        resend
      );

      console.log(`✅ Acceptance notification sent to requester: ${afterData.requestedBy}`);
      return;
    }

    // ========================================================================
    // TRIGGER 2B: Status changed from pending → rejected (initial rejection)
    // ========================================================================
    if (beforeData.status === 'pending' && afterData.status === 'rejected') {
      console.log(`❌ Request rejected: ${requestId}`);

      await createNotification(afterData.requestedBy, {
        type: 'REJECTION_PENDING_CREATOR_DECISION',
        message: `${subjectName} has declined to be set as the subject of record: ${recordName}.`,
        link: `/app/records/${afterData.recordId}`,
        payload: {
          recordId: afterData.recordId,
          requestId,
          subjectId: afterData.subjectId,
          rejectionType: 'request_rejected',
        },
      });

      await sendEmailIfEnabled(
        afterData.requestedBy,
        'REJECTION_PENDING_CREATOR_DECISION',
        {
          subject: `${subjectName} removed themselves from your record`,
          html: buildSubjectDeclinedHtml(subjectName, recordName, recordId),
          text: buildSubjectDeclinedText(subjectName, recordName, recordId),
        },
        resend
      );

      console.log(`✅ Rejection notification sent to requester: ${afterData.requestedBy}`);
      return;
    }

    // ========================================================================
    // TRIGGER 2B: Rejection data added (subject removed after acceptance)
    // This happens when someone accepted, then later removed themselves
    // ========================================================================
    if (isNewRejection(beforeData, afterData)) {
      console.log(`🚫 Subject removal detected: ${requestId}`);

      const rejection = afterData.rejection;

      // Only notify for removals after acceptance (not initial rejections)
      if (rejection?.rejectionType === 'removed_after_acceptance') {
        const recordData = await getRecordData(afterData.recordId);

        if (!recordData) {
          console.log('⚠️ Could not fetch record data for notifications');
          return;
        }

        const targets = getRecordNotificationTargets(recordData);
        const subjectName = await getUserDisplayName(afterData.subjectId);

        await createNotificationForMultiple(targets, {
          type: 'REJECTION_PENDING_CREATOR_DECISION',
          message: `Action Required: ${subjectName} has removed their subject status from record: ${recordName}. Please review and decide whether to publicly list this change.`,
          link: `/app/records/${afterData.recordId}/review-rejection`,
          payload: {
            recordId: afterData.recordId,
            requestId,
            subjectId: afterData.subjectId,
            rejectionType: rejection.rejectionType,
          },
        });

        await sendEmailIfEnabled(
          afterData.requestedBy,
          'REJECTION_PENDING_CREATOR_DECISION',
          {
            subject: `${subjectName} rejected your subject request`,
            html: buildSubjectRemovedHtml(subjectName, recordName, recordId),
            text: buildSubjectRemovedText(subjectName, recordName, recordId),
          },
          resend
        );
        console.log(`✅ Removal notification sent to ${targets.length} record owner(s)`);
      }
      return;
    }

    // ========================================================================
    // TRIGGER 3: Creator responded to rejection
    // ========================================================================
    if (isNewCreatorResponse(beforeData, afterData)) {
      console.log(`📋 Creator responded to rejection: ${requestId}`);

      const rejection = afterData.rejection;
      const creatorResponse = rejection?.creatorResponse;
      const isEscalated = creatorResponse?.status === 'escalated';

      const notificationType: NotificationType = isEscalated
        ? 'REJECTION_ESCALATED'
        : 'REJECTION_ACKNOWLEDGED';

      const message =
        creatorResponse?.status === 'escalated'
          ? `The record creator has escalated your subject status removal for: ${recordName} to Belrose.`
          : `The record creator has acknowledged your subject status removal for: ${recordName}.`;

      await createNotification(afterData.subjectId, {
        type: notificationType,
        message,
        link: `/app/records/${afterData.recordId}`,
        payload: {
          recordId: afterData.recordId,
          requestId,
          subjectId: afterData.subjectId,
        },
      });

      await sendEmailIfEnabled(
        afterData.requestedBy,
        notificationType,
        {
          subject: `${subjectName} rejected your subject request`,
          html: buildCreatorResponseHtml(recordName, recordId, isEscalated),
          text: buildCreatorResponseText(recordName, recordId, isEscalated),
        },
        resend
      );

      console.log(
        `✅ Creator response notification sent to subject: ${afterData.subjectId} (${creatorResponse?.status})`
      );
      return;
    }

    console.log('📭 No relevant changes detected');
  }
);
