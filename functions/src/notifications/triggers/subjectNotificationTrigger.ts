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
 *
 * 3. onRecordSubjectChange - watches records collection
 *    - Subject rejections/removals (notifies record owners)
 *    - Creator responses to rejections (notifies subject)
 */

import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import {
  createNotification,
  createNotificationForMultiple,
  getUserDisplayName,
  getRecordDisplayName,
  NotificationType,
  SourceService,
} from '../notificationUtils';

// ============================================================================
// TYPES
// ============================================================================

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
}

interface SubjectRejection {
  subjectId: string;
  rejectionType: 'request_rejected' | 'removed_after_acceptance' | 'self_removal';
  rejectedAt: Timestamp;
  reason?: string;
  status: 'pending_creator_decision' | 'acknowledged' | 'publicly_listed';
  creatorRespondedAt?: Timestamp;
  publiclyListed: boolean;
  originalConsentSignature?: string;
  rejectionSignature?: string;
}

interface RecordData {
  fileName?: string;
  uploadedBy: string;
  owners?: string[];
  administrators?: string[];
  subjects?: string[];
  subjectRejections?: SubjectRejection[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SOURCE: SourceService = 'Subject';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all users who should be notified about record changes
 * (uploader + owners, deduplicated)
 */
function getRecordNotificationTargets(recordData: RecordData): string[] {
  const targets = [recordData.uploadedBy];

  if (recordData.owners) {
    targets.push(...recordData.owners);
  }

  // Deduplicate
  return [...new Set(targets)];
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
      message: `${requesterName} has requested you as the subject of record: ${recordName}. Please review and respond.`,
      link: `/records/${data.recordId}`,
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
// TRIGGER 2: CONSENT REQUEST UPDATED (ACCEPTED/REJECTED)
// ============================================================================

/**
 * Triggered when a consent request document is updated.
 * Handles status changes from 'pending' to 'accepted' or 'rejected'.
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

    // Only process if status changed
    if (beforeData.status === afterData.status) {
      console.log('📭 Status unchanged, skipping');
      return;
    }

    console.log(
      `🔄 Consent request ${requestId} status changed: ${beforeData.status} → ${afterData.status}`
    );

    const recordName = afterData.recordTitle || (await getRecordDisplayName(afterData.recordId));

    // Handle acceptance
    if (beforeData.status === 'pending' && afterData.status === 'accepted') {
      const subjectName = await getUserDisplayName(afterData.subjectId);

      await createNotification(afterData.requestedBy, {
        type: 'SUBJECT_ACCEPTED',
        sourceService: SOURCE,
        message: `${subjectName} has accepted your subject request for the record: ${recordName}.`,
        link: `/records/${afterData.recordId}`,
        payload: {
          recordId: afterData.recordId,
          requestId,
          subjectId: afterData.subjectId,
        },
      });

      console.log(`✅ Acceptance notification sent to requester: ${afterData.requestedBy}`);
    }

    // Handle rejection
    if (beforeData.status === 'pending' && afterData.status === 'rejected') {
      const subjectName = await getUserDisplayName(afterData.subjectId);

      await createNotification(afterData.requestedBy, {
        type: 'REJECTION_PENDING_CREATOR_DECISION',
        sourceService: SOURCE,
        message: `${subjectName} has declined to be set as the subject of record: ${recordName}.`,
        link: `/records/${afterData.recordId}`,
        payload: {
          recordId: afterData.recordId,
          requestId,
          subjectId: afterData.subjectId,
        },
      });

      console.log(`✅ Rejection notification sent to requester: ${afterData.requestedBy}`);
    }
  }
);

// ============================================================================
// TRIGGER 3: RECORD SUBJECT CHANGES (REJECTIONS/REMOVALS)
// ============================================================================

/**
 * Find rejections that are newly in 'pending_creator_decision' status
 */
function findNewPendingRejections(before: RecordData, after: RecordData): SubjectRejection[] {
  const beforeRejections = before.subjectRejections || [];
  const afterRejections = after.subjectRejections || [];

  return afterRejections.filter(afterRej => {
    if (afterRej.status !== 'pending_creator_decision') return false;

    const existedBefore = beforeRejections.some(
      b => b.subjectId === afterRej.subjectId && b.status === 'pending_creator_decision'
    );

    return !existedBefore;
  });
}

/**
 * Find rejections where status changed from 'pending_creator_decision' to resolved
 */
function findNewlyRespondedRejections(before: RecordData, after: RecordData): SubjectRejection[] {
  const beforeRejections = before.subjectRejections || [];
  const afterRejections = after.subjectRejections || [];

  return afterRejections.filter(afterRej => {
    if (afterRej.status !== 'acknowledged' && afterRej.status !== 'publicly_listed') {
      return false;
    }

    const beforeRej = beforeRejections.find(b => b.subjectId === afterRej.subjectId);

    return beforeRej?.status === 'pending_creator_decision';
  });
}

/**
 * Handle new rejections - notify record owners
 */
async function handleNewRejections(
  rejections: SubjectRejection[],
  recordId: string,
  recordName: string,
  recordData: RecordData
): Promise<void> {
  const targets = getRecordNotificationTargets(recordData);

  for (const rejection of rejections) {
    const subjectName = await getUserDisplayName(rejection.subjectId);

    await createNotificationForMultiple(targets, {
      type: 'REJECTION_PENDING_CREATOR_DECISION',
      sourceService: SOURCE,
      message: `Action Required: ${subjectName} has removed their subject status from record: ${recordName}. Please review and decide whether to publicly list this change.`,
      link: `/records/${recordId}/review-rejection`,
      payload: {
        recordId,
        subjectId: rejection.subjectId,
      },
    });
  }
}

/**
 * Handle responded rejections - notify the subject of the creator's decision
 */
async function handleRespondedRejections(
  rejections: SubjectRejection[],
  recordId: string,
  recordName: string
): Promise<void> {
  for (const rejection of rejections) {
    const notificationType: NotificationType =
      rejection.status === 'publicly_listed'
        ? 'REJECTION_PUBLICLY_LISTED'
        : 'REJECTION_ACKNOWLEDGED';

    const message =
      rejection.status === 'publicly_listed'
        ? `The record creator has publicly listed your subject status removal for: ${recordName}.`
        : `The record creator has acknowledged your subject status removal for: ${recordName}.`;

    await createNotification(rejection.subjectId, {
      type: notificationType,
      sourceService: SOURCE,
      message,
      link: `/records/${recordId}`,
      payload: {
        recordId,
        subjectId: rejection.subjectId,
      },
    });
  }
}

/**
 * Triggered when a record document is updated.
 * Handles subject rejection flows (which still live on the record document).
 */
export const onRecordSubjectChange = onDocumentUpdated('records/{recordId}', async event => {
  const recordId = event.params.recordId;
  const beforeData = event.data?.before.data() as RecordData | undefined;
  const afterData = event.data?.after.data() as RecordData | undefined;

  if (!beforeData || !afterData) {
    console.log('⚠️ No data to compare, skipping');
    return;
  }

  console.log(`🔍 Checking subject rejection changes for record: ${recordId}`);

  // Detect rejection-related changes only
  const newRejections = findNewPendingRejections(beforeData, afterData);
  const respondedRejections = findNewlyRespondedRejections(beforeData, afterData);

  const totalChanges = newRejections.length + respondedRejections.length;

  if (totalChanges === 0) {
    console.log('📭 No subject rejection changes detected');
    return;
  }

  console.log(`📬 Found ${totalChanges} subject rejection change(s) to process`);

  const recordName = await getRecordDisplayName(recordId);

  // Process rejection changes
  await handleNewRejections(newRejections, recordId, recordName, afterData);
  await handleRespondedRejections(respondedRejections, recordId, recordName);

  console.log(`✅ Finished processing subject rejection changes for record: ${recordId}`);
});
