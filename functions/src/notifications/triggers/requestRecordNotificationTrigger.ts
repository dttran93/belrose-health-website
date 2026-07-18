// functions/src/notifications/triggers/requestRecordNotificationTrigger.ts

import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { createNotification, getUserDisplayName } from '../notificationUtils';
import type { RecordRequest } from '@belrose/shared';
import { resendKey, sendEmailIfEnabled } from '../emailUtils';
import {
  buildRecordRequestDeniedHtml,
  buildRecordRequestDeniedText,
  buildRecordRequestFulfilledHtml,
  buildRecordRequestFulfilledText,
  buildRecordRequestViewedHtml,
  buildRecordRequestViewedText,
} from '../emails/recordRequestEmailTemplate';
import { Resend } from 'resend';

/**
 * Triggered when a new Record Request is created. Sent to the target user in-app and their email.
 */
export const onRecordRequestCreated = onDocumentCreated(
  'recordRequests/{requestId}',
  async event => {
    const data = event.data?.data() as RecordRequest | undefined;
    if (!data || !data.targetUserId) return;

    const requesterName = await getUserDisplayName(data.requesterId);

    await createNotification(data.targetUserId, {
      type: 'RECORD_REQUEST_RECEIVED',
      message: `${requesterName} is requesting medical records from you.`,
      link: `/fulfill-request?code=${data.inviteCode}`,
      payload: { requestId: data.inviteCode, requestedBy: data.requesterId },
    });

    //Email notification sent through createRecordRequests (request landing portal covers both users and guests).
  }
);

/**
 * Triggered when a Record Request is updated.
 * Handles: First View, Fulfillment, and Denial.
 */
export const onRecordRequestUpdated = onDocumentUpdated(
  'recordRequests/{requestId}',
  async event => {
    const before = event.data?.before.data() as RecordRequest | undefined;
    const after = event.data?.after.data() as RecordRequest | undefined;

    if (!before || !after) return;

    const requestId = event.params.requestId;

    // The Resend constructor throws synchronously when the API key is missing/empty (e.g. a
    // local/emulator run without RESEND_API_KEY configured) — this is a background trigger with
    // no caller to surface an error to, so a missing key must degrade to "skip email" rather than
    // crash the whole trigger (in-app notifications below still fire either way).
    let resend: Resend | null = null;
    try {
      resend = new Resend(resendKey.value());
    } catch (err) {
      console.warn('⚠️ Resend not configured — skipping email notifications for this update:', err);
    }

    // CASE 1: First View (readAt changed from null to timestamp)
    if (!before.readAt && after.readAt) {
      await createNotification(after.requesterId, {
        type: 'RECORD_REQUEST_VIEWED',
        message: `Your record request to ${after.targetEmail} has been opened.`,
        link: `/app/requests`, // Link to their dashboard
        payload: { requestId },
      });

      if (resend) {
        await sendEmailIfEnabled(
          after.requesterId,
          'RECORD_REQUEST_VIEWED',
          {
            subject: `Your record request to ${after.targetEmail} has been opened`,
            html: buildRecordRequestViewedHtml(after.targetEmail),
            text: buildRecordRequestViewedText(after.targetEmail),
          },
          resend
        );
      }

      return;
    }

    // CASE 2: Fulfilled
    if (before.status === 'pending' && after.status === 'fulfilled') {
      await createNotification(after.requesterId, {
        type: 'RECORD_REQUEST_FULFILLED',
        message: `Success! ${after.targetEmail} has uploaded your requested records.`,
        link: after.fulfilledRecordIds?.[0]
          ? `/app/records/${after.fulfilledRecordIds[0]}`
          : `/app/requests`,
        payload: { requestId, recordIds: after.fulfilledRecordIds },
      });
      if (resend) {
        await sendEmailIfEnabled(
          after.requesterId,
          'RECORD_REQUEST_FULFILLED',
          {
            subject: `Your records have been uploaded by ${after.targetEmail}`,
            html: buildRecordRequestFulfilledHtml(
              after.targetEmail,
              after.fulfilledRecordIds?.[0] ?? null
            ),
            text: buildRecordRequestFulfilledText(
              after.targetEmail,
              after.fulfilledRecordIds?.[0] ?? null
            ),
          },
          resend
        );
      }
      return;
    }

    // CASE 3: Denied
    if (before.status === 'pending' && after.status === 'denied') {
      const reasonText = after.deniedReason ? ` Reason: ${after.deniedReason}` : '';
      await createNotification(after.requesterId, {
        type: 'RECORD_REQUEST_DENIED',
        message: `${after.targetEmail} declined your record request.${reasonText}`,
        link: `/app/requests`,
        payload: { requestId, deniedReason: after.deniedReason },
      });
      if (resend) {
        await sendEmailIfEnabled(
          after.requesterId,
          'RECORD_REQUEST_DENIED',
          {
            subject: `${after.targetEmail} declined your record request`,
            html: buildRecordRequestDeniedHtml(after.targetEmail, after.deniedReason),
            text: buildRecordRequestDeniedText(after.targetEmail, after.deniedReason),
          },
          resend
        );
      }
      return;
    }
  }
);
