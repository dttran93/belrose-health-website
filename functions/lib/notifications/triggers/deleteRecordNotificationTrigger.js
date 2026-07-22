"use strict";
// functions/src/notifications/triggers/deleteRecordNotificationTrigger.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRecordDeletionEventCreated = void 0;
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
const firestore_1 = require("firebase-functions/v2/firestore");
const notificationUtils_1 = require("../notificationUtils");
const resend_1 = require("resend");
const emailUtils_1 = require("../emailUtils");
const recordDeletionEmailTemplates_1 = require("../emails/recordDeletionEmailTemplates");
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Collect all unique user IDs who should be notified about a deletion,
 * excluding the user who performed the deletion.
 */
function getAffectedUserIds(event) {
    const { owners, administrators, viewers, sharers, subjects } = event.affectedUsers;
    const all = [...owners, ...administrators, ...viewers, ...sharers, ...subjects];
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
    const recordName = `Record ${recordId.slice(0, 8)}...`;
    await (0, notificationUtils_1.createNotificationForMultiple)(affectedUserIds, {
        type: 'RECORD_DELETED',
        message: `${deleterName} has permanently deleted the record: ${recordName}. You no longer have access to this record.`,
        link: `/app/records`,
        payload: {
            recordId,
            deletedBy: data.deletedBy,
        },
    });
    const resend = new resend_1.Resend(emailUtils_1.resendKey.value());
    await Promise.all(affectedUserIds.map(uid => (0, emailUtils_1.sendEmailIfEnabled)(uid, 'RECORD_DELETED', {
        subject: `${deleterName} deleted a record you had access to`,
        html: (0, recordDeletionEmailTemplates_1.buildRecordDeletedHtml)(deleterName, recordName),
        text: (0, recordDeletionEmailTemplates_1.buildRecordDeletedText)(deleterName, recordName),
    }, resend)));
    console.log(`✅ Deletion notifications sent to ${affectedUserIds.length} user(s) for record: ${recordId}`);
});
//# sourceMappingURL=deleteRecordNotificationTrigger.js.map