"use strict";
// functions/src/notifications/triggers/requestRecordNotificationTrigger.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRecordRequestUpdated = exports.onRecordRequestCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const notificationUtils_1 = require("../notificationUtils");
const emailUtils_1 = require("../emailUtils");
const recordRequestEmailTemplate_1 = require("../emails/recordRequestEmailTemplate");
const resend_1 = require("resend");
/**
 * Triggered when a new Record Request is created. Sent to the target user in-app and their email.
 */
exports.onRecordRequestCreated = (0, firestore_1.onDocumentCreated)('recordRequests/{requestId}', async (event) => {
    const data = event.data?.data();
    if (!data || !data.targetUserId)
        return;
    const requesterName = await (0, notificationUtils_1.getUserDisplayName)(data.requesterId);
    await (0, notificationUtils_1.createNotification)(data.targetUserId, {
        type: 'RECORD_REQUEST_RECEIVED',
        message: `${requesterName} is requesting medical records from you.`,
        link: `/fulfill-request?code=${data.inviteCode}`,
        payload: { requestId: data.inviteCode, requestedBy: data.requesterId },
    });
    //Email notification sent through createRecordRequests (request landing portal covers both users and guests).
});
/**
 * Triggered when a Record Request is updated.
 * Handles: First View, Fulfillment, and Denial.
 */
exports.onRecordRequestUpdated = (0, firestore_1.onDocumentUpdated)('recordRequests/{requestId}', async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const resend = new resend_1.Resend(emailUtils_1.resendKey.value());
    if (!before || !after)
        return;
    const requestId = event.params.requestId;
    // CASE 1: First View (readAt changed from null to timestamp)
    if (!before.readAt && after.readAt) {
        await (0, notificationUtils_1.createNotification)(after.requesterId, {
            type: 'RECORD_REQUEST_VIEWED',
            message: `Your record request to ${after.targetEmail} has been opened.`,
            link: `/app/requests`, // Link to their dashboard
            payload: { requestId },
        });
        await (0, emailUtils_1.sendEmailIfEnabled)(after.requesterId, 'RECORD_REQUEST_VIEWED', {
            subject: `Your record request to ${after.targetEmail} has been opened`,
            html: (0, recordRequestEmailTemplate_1.buildRecordRequestViewedHtml)(after.targetEmail),
            text: (0, recordRequestEmailTemplate_1.buildRecordRequestViewedText)(after.targetEmail),
        }, resend);
        return;
    }
    // CASE 2: Fulfilled
    if (before.status === 'pending' && after.status === 'fulfilled') {
        await (0, notificationUtils_1.createNotification)(after.requesterId, {
            type: 'RECORD_REQUEST_FULFILLED',
            message: `Success! ${after.targetEmail} has uploaded your requested records.`,
            link: after.fulfilledRecordIds?.[0]
                ? `/app/records/${after.fulfilledRecordIds[0]}`
                : `/app/requests`,
            payload: { requestId, recordIds: after.fulfilledRecordIds },
        });
        await (0, emailUtils_1.sendEmailIfEnabled)(after.requesterId, 'RECORD_REQUEST_FULFILLED', {
            subject: `Your records have been uploaded by ${after.targetEmail}`,
            html: (0, recordRequestEmailTemplate_1.buildRecordRequestFulfilledHtml)(after.targetEmail, after.fulfilledRecordIds?.[0] ?? null),
            text: (0, recordRequestEmailTemplate_1.buildRecordRequestFulfilledText)(after.targetEmail, after.fulfilledRecordIds?.[0] ?? null),
        }, resend);
        return;
    }
    // CASE 3: Denied
    if (before.status === 'pending' && after.status === 'denied') {
        const reasonText = after.deniedReason ? ` Reason: ${after.deniedReason}` : '';
        await (0, notificationUtils_1.createNotification)(after.requesterId, {
            type: 'RECORD_REQUEST_DENIED',
            message: `${after.targetEmail} declined your record request.${reasonText}`,
            link: `/app/requests`,
            payload: { requestId, deniedReason: after.deniedReason },
        });
        await (0, emailUtils_1.sendEmailIfEnabled)(after.requesterId, 'RECORD_REQUEST_DENIED', {
            subject: `${after.targetEmail} declined your record request`,
            html: (0, recordRequestEmailTemplate_1.buildRecordRequestDeniedHtml)(after.targetEmail, after.deniedReason),
            text: (0, recordRequestEmailTemplate_1.buildRecordRequestDeniedText)(after.targetEmail, after.deniedReason),
        }, resend);
        return;
    }
});
//# sourceMappingURL=requestRecordNotificationTrigger.js.map