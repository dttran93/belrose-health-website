"use strict";
// functions/src/notifications/triggers/deleteRecordNotificationTrigger.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRecordDeletionEventUpdated = exports.onRecordDeletionEventCreated = void 0;
/**
 * Record Deletion Notification Triggers
 *
 * Firestore triggers that watch the recordDeletionEvents collection and
 * automatically create notifications for affected users.
 *
 * Two triggers:
 * 1. onRecordDeletionEventCreated - watches recordDeletionEvents collection
 *    - Notifies all affected users (owners, admins, viewers) that the record was deleted
 *
 * 2. onRecordDeletionEventUpdated - watches recordDeletionEvents collection
 *    - Fires when deletionComplete flips to true (Firebase deletion finished)
 *    - Currently a no-op hook — reserved for any post-deletion follow-up if needed
 */
const firestore_1 = require("firebase-functions/v2/firestore");
const notificationUtils_1 = require("../notificationUtils");
// ============================================================================
// CONSTANTS
// ============================================================================
const SOURCE = 'Record';
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Collect all unique user IDs who should be notified about a deletion,
 * excluding the user who performed the deletion.
 */
function getAffectedUserIds(event) {
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
exports.onRecordDeletionEventCreated = (0, firestore_1.onDocumentCreated)('recordDeletionEvents/{recordId}', async (event) => {
    const recordId = event.params.recordId;
    const data = event.data?.data();
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
    const deleterName = await (0, notificationUtils_1.getUserDisplayName)(data.deletedBy);
    const recordName = data.recordTitle || `Record ${recordId.slice(0, 8)}...`;
    await (0, notificationUtils_1.createNotificationForMultiple)(affectedUserIds, {
        type: 'RECORD_DELETED',
        sourceService: SOURCE,
        message: `${deleterName} has permanently deleted the record: ${recordName}. You no longer have access to this record.`,
        link: `/app/records`,
        payload: {
            recordId,
            subjectId: '', // Not subject-specific — required by NotificationPayload shape
            deletedBy: data.deletedBy,
        },
    });
    console.log(`✅ Deletion notifications sent to ${affectedUserIds.length} user(s) for record: ${recordId}`);
});
// ============================================================================
// TRIGGER 2: DELETION EVENT UPDATED (deletionComplete → true)
// ============================================================================
/**
 * Triggered when a recordDeletionEvent document is updated.
 *
 * Currently handles the deletionComplete flag flipping to true, which means
 * the Firebase deletion (storage + Firestore + versions + keys) has finished.
 *
 * No additional notifications are sent at this point — users were already
 * notified on creation. This trigger is reserved for any future post-deletion
 * logic (e.g., analytics, audit logging, cascade cleanup).
 */
exports.onRecordDeletionEventUpdated = (0, firestore_1.onDocumentUpdated)('recordDeletionEvents/{recordId}', async (event) => {
    const recordId = event.params.recordId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!beforeData || !afterData) {
        console.log('⚠️ No data to compare, skipping');
        return;
    }
    // ========================================================================
    // CASE 1: Deletion marked complete
    // ========================================================================
    if (!beforeData.deletionComplete && afterData.deletionComplete) {
        console.log(`✅ Record deletion fully complete: ${recordId}`);
        // Reserved for future post-deletion logic
        return;
    }
    console.log('📭 No relevant changes detected on deletion event');
});
//# sourceMappingURL=deleteRecordNotificationTrigger.js.map