"use strict";
// functions/src/notifications/triggers/subjectNotificationTrigger.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRecordSubjectChange = void 0;
/**
 * Subject Notification Trigger
 *
 * Firestore trigger that watches for subject-related changes on records
 * and automatically creates notifications.
 *
 * Handles:
 * - New subject requests (notifies proposed subject)
 * - Accepted requests (notifies requester)
 * - Rejections (notifies record owners)
 * - Creator responses to rejections (notifies subject)
 */
const firestore_1 = require("firebase-functions/v2/firestore");
const notificationUtils_1 = require("../notificationUtils");
// ============================================================================
// CONSTANTS
// ============================================================================
const SOURCE = 'Subject';
// ============================================================================
// DIFF DETECTION HELPERS
// ============================================================================
/**
 * Find pending requests that are new (didn't exist before as pending)
 */
function findNewPendingRequests(before, after) {
    const beforeRequests = before.pendingSubjectRequests || [];
    const afterRequests = after.pendingSubjectRequests || [];
    return afterRequests.filter(afterReq => {
        if (afterReq.status !== 'pending')
            return false;
        const existedBefore = beforeRequests.some(b => b.subjectId === afterReq.subjectId &&
            b.requestedBy === afterReq.requestedBy &&
            b.status === 'pending');
        return !existedBefore;
    });
}
/**
 * Find requests that changed from 'pending' to 'accepted'
 */
function findNewlyAcceptedRequests(before, after) {
    const beforeRequests = before.pendingSubjectRequests || [];
    const afterRequests = after.pendingSubjectRequests || [];
    return afterRequests.filter(afterReq => {
        if (afterReq.status !== 'accepted')
            return false;
        const beforeReq = beforeRequests.find(b => b.subjectId === afterReq.subjectId && b.requestedBy === afterReq.requestedBy);
        // Newly accepted if it didn't exist before OR was pending before
        return !beforeReq || beforeReq.status === 'pending';
    });
}
/**
 * Find rejections that are newly in 'pending_creator_decision' status
 */
function findNewPendingRejections(before, after) {
    const beforeRejections = before.subjectRejections || [];
    const afterRejections = after.subjectRejections || [];
    return afterRejections.filter(afterRej => {
        if (afterRej.status !== 'pending_creator_decision')
            return false;
        const existedBefore = beforeRejections.some(b => b.subjectId === afterRej.subjectId && b.status === 'pending_creator_decision');
        return !existedBefore;
    });
}
/**
 * Find rejections where status changed from 'pending_creator_decision' to resolved
 */
function findNewlyRespondedRejections(before, after) {
    const beforeRejections = before.subjectRejections || [];
    const afterRejections = after.subjectRejections || [];
    return afterRejections.filter(afterRej => {
        if (afterRej.status !== 'acknowledged' && afterRej.status !== 'publicly_listed') {
            return false;
        }
        const beforeRej = beforeRejections.find(b => b.subjectId === afterRej.subjectId);
        return (beforeRej === null || beforeRej === void 0 ? void 0 : beforeRej.status) === 'pending_creator_decision';
    });
}
/**
 * Get all users who should be notified about record changes
 * (uploader + owners, deduplicated)
 */
function getRecordNotificationTargets(recordData) {
    const targets = [recordData.uploadedBy];
    if (recordData.owners) {
        targets.push(...recordData.owners);
    }
    // Deduplicate
    return [...new Set(targets)];
}
// ============================================================================
// NOTIFICATION HANDLERS
// ============================================================================
async function handleNewPendingRequests(requests, recordId, recordName) {
    for (const request of requests) {
        const requesterName = await (0, notificationUtils_1.getUserDisplayName)(request.requestedBy);
        await (0, notificationUtils_1.createNotification)(request.subjectId, {
            type: 'SUBJECT_REQUEST_RECEIVED',
            sourceService: SOURCE,
            message: `${requesterName} has requested you as the subject of record: ${recordName}. Please review and respond.`,
            link: `/records/${recordId}`,
            payload: {
                recordId,
                subjectId: request.subjectId,
                requestedBy: request.requestedBy,
            },
        });
    }
}
async function handleAcceptedRequests(requests, recordId, recordName) {
    for (const request of requests) {
        const subjectName = await (0, notificationUtils_1.getUserDisplayName)(request.subjectId);
        await (0, notificationUtils_1.createNotification)(request.requestedBy, {
            type: 'SUBJECT_ACCEPTED',
            sourceService: SOURCE,
            message: `${subjectName} has accepted your subject request for the record: ${recordName}.`,
            link: `/records/${recordId}`,
            payload: {
                recordId,
                subjectId: request.subjectId,
            },
        });
    }
}
async function handleNewRejections(rejections, recordId, recordName, recordData) {
    const targets = getRecordNotificationTargets(recordData);
    for (const rejection of rejections) {
        const subjectName = await (0, notificationUtils_1.getUserDisplayName)(rejection.subjectId);
        await (0, notificationUtils_1.createNotificationForMultiple)(targets, {
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
async function handleRespondedRejections(rejections, recordId, recordName) {
    for (const rejection of rejections) {
        const notificationType = rejection.status === 'publicly_listed'
            ? 'REJECTION_PUBLICLY_LISTED'
            : 'REJECTION_ACKNOWLEDGED';
        const message = rejection.status === 'publicly_listed'
            ? `The record creator has publicly listed your subject status removal for: ${recordName}.`
            : `The record creator has acknowledged your subject status removal for: ${recordName}.`;
        await (0, notificationUtils_1.createNotification)(rejection.subjectId, {
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
// ============================================================================
// MAIN TRIGGER
// ============================================================================
/*
 *Basically everything hinges on "onDocumentUpdated" because of that, everytime something changes in records/{recordId}
 * an Event Object is passed by Firestore into this function. This event object has the state of the collection before
 * and after the update. Thus, it can figure out what changed, and then we can run a notification based on the changes
 */
exports.onRecordSubjectChange = (0, firestore_1.onDocumentUpdated)('records/{recordId}', async (event) => {
    var _a, _b;
    const recordId = event.params.recordId;
    const beforeData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const afterData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!beforeData || !afterData) {
        console.log('⚠️ No data to compare, skipping');
        return;
    }
    console.log(`🔍 Checking subject changes for record: ${recordId}`);
    const recordName = await (0, notificationUtils_1.getRecordDisplayName)(recordId);
    // Detect all changes
    const newPendingRequests = findNewPendingRequests(beforeData, afterData);
    const acceptedRequests = findNewlyAcceptedRequests(beforeData, afterData);
    const newRejections = findNewPendingRejections(beforeData, afterData);
    const respondedRejections = findNewlyRespondedRejections(beforeData, afterData);
    // Log what we found
    const totalChanges = newPendingRequests.length +
        acceptedRequests.length +
        newRejections.length +
        respondedRejections.length;
    if (totalChanges === 0) {
        console.log('📭 No subject-related changes detected');
        return;
    }
    console.log(`📬 Found ${totalChanges} subject change(s) to process`);
    // Process each type
    await handleNewPendingRequests(newPendingRequests, recordId, recordName);
    await handleAcceptedRequests(acceptedRequests, recordId, recordName);
    await handleNewRejections(newRejections, recordId, recordName, afterData);
    await handleRespondedRejections(respondedRejections, recordId, recordName);
    console.log(`✅ Finished processing subject changes for record: ${recordId}`);
});
//# sourceMappingURL=subjectNotificationTrigger.js.map