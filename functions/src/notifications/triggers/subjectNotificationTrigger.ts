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
  SourceService,
} from '../notificationUtils';
import { FileObject } from '../../../../src/types/core';

// ============================================================================
// TYPES
// ============================================================================

export type SubjectRejectionType = 'request_rejected' | 'removed_after_acceptance';
type CreatorResponseStatus = 'pending_creator_decision' | 'acknowledged' | 'publicly_listed';

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

// ============================================================================
// CONSTANTS
// ============================================================================

const SOURCE: SourceService = 'Subject';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get record data from Firestore
 */
async function getRecordData(recordId: string): Promise<FileObject | null> {
  const db = getFirestore();
  const recordDoc = await db.collection('records').doc(recordId).get();

  if (!recordDoc.exists) {
    console.log(`⚠️ Record ${recordId} not found`);
    return null;
  }

  return recordDoc.data() as FileObject;
}

/**
 * Get all users who should be notified about record changes
 * (uploader + owners, deduplicated)
 */
function getRecordNotificationTargets(record: FileObject): string[] {
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
    (afterStatus === 'acknowledged' || afterStatus === 'publicly_listed')
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
  'subjectConsentRequests/{requestId}',
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
      sourceService: SOURCE,
      message: `${requesterName} has requested to set you as the subject of record: ${recordName}. Please review and respond.`,
      link: `/dashboard/records/${data.recordId}/review-subject-request`,
      payload: {
        recordId: data.recordId,
        requestId,
        subjectId: data.subjectId,
        requestedBy: data.requestedBy,
        requestedSubjectRole: data.requestedSubjectRole,
      },
    });

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

    // ========================================================================
    // CASE 1: Status changed from pending → accepted
    // ========================================================================
    if (beforeData.status === 'pending' && afterData.status === 'accepted') {
      console.log(`✅ Request accepted: ${requestId}`);

      const subjectName = await getUserDisplayName(afterData.subjectId);

      await createNotification(afterData.requestedBy, {
        type: 'SUBJECT_ACCEPTED',
        sourceService: SOURCE,
        message: `${subjectName} has accepted your subject request for the record: ${recordName}.`,
        link: `/dashboard/records/${afterData.recordId}`,
        payload: {
          recordId: afterData.recordId,
          requestId,
          subjectId: afterData.subjectId,
        },
      });

      console.log(`✅ Acceptance notification sent to requester: ${afterData.requestedBy}`);
      return;
    }

    // ========================================================================
    // CASE 2: Status changed from pending → rejected (initial rejection)
    // ========================================================================
    if (beforeData.status === 'pending' && afterData.status === 'rejected') {
      console.log(`❌ Request rejected: ${requestId}`);

      const subjectName = await getUserDisplayName(afterData.subjectId);

      await createNotification(afterData.requestedBy, {
        type: 'REJECTION_PENDING_CREATOR_DECISION',
        sourceService: SOURCE,
        message: `${subjectName} has declined to be set as the subject of record: ${recordName}.`,
        link: `/dashboard/records/${afterData.recordId}`,
        payload: {
          recordId: afterData.recordId,
          requestId,
          subjectId: afterData.subjectId,
        },
      });

      console.log(`✅ Rejection notification sent to requester: ${afterData.requestedBy}`);
      return;
    }

    // ========================================================================
    // CASE 3: Rejection data added (subject removed after acceptance)
    // This happens when someone accepted, then later removed themselves
    // ========================================================================
    if (isNewRejection(beforeData, afterData)) {
      console.log(`🚫 Subject removal detected: ${requestId}`);

      const rejection = afterData.rejection!;

      // Only notify for removals after acceptance (not initial rejections)
      if (rejection.rejectionType === 'removed_after_acceptance') {
        const recordData = await getRecordData(afterData.recordId);

        if (!recordData) {
          console.log('⚠️ Could not fetch record data for notifications');
          return;
        }

        const targets = getRecordNotificationTargets(recordData);
        const subjectName = await getUserDisplayName(afterData.subjectId);

        await createNotificationForMultiple(targets, {
          type: 'REJECTION_PENDING_CREATOR_DECISION',
          sourceService: SOURCE,
          message: `Action Required: ${subjectName} has removed their subject status from record: ${recordName}. Please review and decide whether to publicly list this change.`,
          link: `/dashboard/records/${afterData.recordId}/review-rejection`,
          payload: {
            recordId: afterData.recordId,
            requestId,
            subjectId: afterData.subjectId,
            rejectionType: rejection.rejectionType,
          },
        });

        console.log(`✅ Removal notification sent to ${targets.length} record owner(s)`);
      }

      return;
    }

    // ========================================================================
    // CASE 4: Creator responded to rejection
    // ========================================================================
    if (isNewCreatorResponse(beforeData, afterData)) {
      console.log(`📋 Creator responded to rejection: ${requestId}`);

      const rejection = afterData.rejection!;
      const creatorResponse = rejection.creatorResponse!;

      const notificationType: NotificationType =
        creatorResponse.status === 'publicly_listed'
          ? 'REJECTION_PUBLICLY_LISTED'
          : 'REJECTION_ACKNOWLEDGED';

      const message =
        creatorResponse.status === 'publicly_listed'
          ? `The record creator has publicly listed your subject status removal for: ${recordName}.`
          : `The record creator has acknowledged your subject status removal for: ${recordName}.`;

      await createNotification(afterData.subjectId, {
        type: notificationType,
        sourceService: SOURCE,
        message,
        link: `/dashboard/records/${afterData.recordId}`,
        payload: {
          recordId: afterData.recordId,
          requestId,
          subjectId: afterData.subjectId,
          publiclyListed: creatorResponse.publiclyListed,
        },
      });

      console.log(
        `✅ Creator response notification sent to subject: ${afterData.subjectId} (${creatorResponse.status})`
      );
      return;
    }

    console.log('📭 No relevant changes detected');
  }
);
