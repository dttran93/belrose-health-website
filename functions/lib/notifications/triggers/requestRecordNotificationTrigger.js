"use strict";
// functions/src/notifications/triggers/requestRecordNotificationTrigger.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRecordRequestUpdated = exports.onRecordRequestCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const notificationUtils_1 = require("../notificationUtils");
const SOURCE = 'RequestRecord';
/**
 * Triggered when a new Record Request is created.
 * Note: The actual EMAIL to the provider is usually sent by the
 * Callable Function that creates the doc, but we can trigger
 * an in-app notification here if the target is an existing user.
 */
exports.onRecordRequestCreated = (0, firestore_1.onDocumentCreated)('recordRequests/{requestId}', async (event) => {
    const data = event.data?.data();
    if (!data || !data.targetUserId)
        return;
    const requesterName = await (0, notificationUtils_1.getUserDisplayName)(data.requesterId);
    await (0, notificationUtils_1.createNotification)(data.targetUserId, {
        type: 'RECORD_REQUEST_RECEIVED',
        sourceService: SOURCE,
        message: `${requesterName} is requesting medical records from you.`,
        link: `/fulfill-request?code=${data.inviteCode}`,
        payload: { requestId: data.inviteCode },
    });
});
/**
 * Triggered when a Record Request is updated.
 * Handles: First View, Fulfillment, and Denial.
 */
exports.onRecordRequestUpdated = (0, firestore_1.onDocumentUpdated)('recordRequests/{requestId}', async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    const requestId = event.params.requestId;
    // CASE 1: First View (readAt changed from null to timestamp)
    if (!before.readAt && after.readAt) {
        await (0, notificationUtils_1.createNotification)(after.requesterId, {
            type: 'RECORD_REQUEST_VIEWED',
            sourceService: SOURCE,
            message: `Your record request to ${after.targetEmail} has been opened.`,
            link: `/app/requests`, // Link to their dashboard
            payload: { requestId },
        });
        return;
    }
    // CASE 2: Fulfilled
    if (before.status === 'pending' && after.status === 'fulfilled') {
        await (0, notificationUtils_1.createNotification)(after.requesterId, {
            type: 'RECORD_REQUEST_FULFILLED',
            sourceService: SOURCE,
            message: `Success! ${after.targetEmail} has uploaded your requested records.`,
            link: after.fulfilledRecordIds?.[0]
                ? `/app/records/${after.fulfilledRecordIds[0]}`
                : `/app/requests`,
            payload: { requestId, recordIds: after.fulfilledRecordIds },
        });
        return;
    }
    // CASE 3: Denied
    if (before.status === 'pending' && after.status === 'denied') {
        const reasonText = after.deniedReason ? ` Reason: ${after.deniedReason}` : '';
        await (0, notificationUtils_1.createNotification)(after.requesterId, {
            type: 'RECORD_REQUEST_DENIED',
            sourceService: SOURCE,
            message: `${after.targetEmail} declined your record request.${reasonText}`,
            link: `/app/requests`,
            payload: { requestId, deniedReason: after.deniedReason },
        });
        return;
    }
});
//# sourceMappingURL=requestRecordNotificationTrigger.js.map