"use strict";
/**
 * Credibility Notification Triggers
 *
 * Three triggers:
 * 1. onVerificationWritten   — verifications created/updated
 * 2. onDisputeWritten        — disputes created/updated
 *
 * Who gets notified:
 * - Verifications/Disputes: record owners + subjects (not the actor themselves)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onDisputeUpdated = exports.onDisputeWritten = exports.onVerificationUpdated = exports.onVerificationWritten = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const resend_1 = require("resend");
const params_1 = require("firebase-functions/params");
const notificationUtils_1 = require("../notificationUtils");
const emailUtils_1 = require("../emailUtils");
const credibilityEmailTemplates_1 = require("../emails/credibilityEmailTemplates");
// ============================================================================
// CONSTANTS
// ============================================================================
const resendKey = (0, params_1.defineSecret)('RESEND_API_KEY');
const VERIFICATION_LEVEL_NAMES = {
    1: 'Provenance',
    2: 'Content',
    3: 'Full',
};
const DISPUTE_SEVERITY_NAMES = {
    1: 'Negligible',
    2: 'Moderate',
    3: 'Major',
};
// ============================================================================
// HELPERS
// ============================================================================
async function getRecordStakeholders(recordId, excludeUserId) {
    const recordSnap = await (0, firestore_2.getFirestore)().collection('records').doc(recordId).get();
    if (!recordSnap.exists)
        return [];
    const record = recordSnap.data();
    const targets = [...(record.owners ?? []), ...(record.subjects ?? [])];
    return [...new Set(targets)].filter(uid => uid !== excludeUserId);
}
function stripUndefined(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}
// ============================================================================
// TRIGGER 1: VERIFICATION WRITTEN
// ============================================================================
exports.onVerificationWritten = (0, firestore_1.onDocumentCreated)({ document: 'verifications/{verificationId}', secrets: [resendKey] }, async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    // Only notify for confirmed on-chain verifications
    if (data.chainStatus !== 'confirmed' || !data.isActive)
        return;
    const targets = await getRecordStakeholders(data.recordId, data.verifierId);
    if (targets.length === 0)
        return;
    const verifierName = await (0, notificationUtils_1.getUserDisplayName)(data.verifierId);
    const levelName = VERIFICATION_LEVEL_NAMES[data.level];
    const recordFallback = `Record ${data.recordId.slice(0, 8)}...`;
    await (0, notificationUtils_1.createNotificationForMultiple)(targets, {
        type: 'VERIFICATION_ADDED',
        message: `${verifierName} added a ${levelName} verification to ${recordFallback}.`,
        link: `/app/records/${data.recordId}`,
        payload: stripUndefined({
            recordId: data.recordId,
            recordHash: data.recordHash,
            verifierId: data.verifierId,
            level: data.level,
            encryptedRecordTitle: data.encryptedRecordTitle,
            encryptedRecordTitleIv: data.encryptedRecordTitleIv,
        }),
    });
    const resend = new resend_1.Resend(resendKey.value());
    await Promise.all(targets.map(uid => (0, emailUtils_1.sendEmailIfEnabled)(uid, 'VERIFICATION_ADDED', {
        subject: `${verifierName} verified a record you're connected to`,
        html: (0, credibilityEmailTemplates_1.buildVerificationAddedHtml)(verifierName, recordFallback, data.recordId, levelName),
        text: (0, credibilityEmailTemplates_1.buildVerificationAddedText)(verifierName, recordFallback, data.recordId, levelName),
    }, resend)));
    console.log(`✅ Verification notifications sent to ${targets.length} stakeholder(s)`);
});
// ============================================================================
// TRIGGER 2: VERIFICATION UPDATED - MODIFY OR RETRACT
// ============================================================================
exports.onVerificationUpdated = (0, firestore_1.onDocumentUpdated)({ document: 'verifications/{verificationId}', secrets: [resendKey] }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    const targets = await getRecordStakeholders(after.recordId, after.verifierId);
    if (targets.length === 0)
        return;
    const verifierName = await (0, notificationUtils_1.getUserDisplayName)(after.verifierId);
    const recordFallback = `Record ${after.recordId.slice(0, 8)}...`;
    const resend = new resend_1.Resend(resendKey.value());
    // CASE 1: Retracted (isActive flipped to false)
    if (before.isActive && !after.isActive) {
        await (0, notificationUtils_1.createNotificationForMultiple)(targets, {
            type: 'VERIFICATION_RETRACTED',
            message: `${verifierName} retracted their verification on ${recordFallback}.`,
            link: `/app/records/${after.recordId}`,
            payload: stripUndefined({
                recordId: after.recordId,
                recordHash: after.recordHash,
                verifierId: after.verifierId,
                encryptedRecordTitle: after.encryptedRecordTitle,
                encryptedRecordTitleIv: after.encryptedRecordTitleIv,
            }),
        });
        await Promise.all(targets.map(uid => (0, emailUtils_1.sendEmailIfEnabled)(uid, 'VERIFICATION_RETRACTED', {
            subject: `${verifierName} retracted their verification`,
            html: (0, credibilityEmailTemplates_1.buildVerificationRetractedHtml)(verifierName, recordFallback, after.recordId),
            text: (0, credibilityEmailTemplates_1.buildVerificationRetractedText)(verifierName, recordFallback, after.recordId),
        }, resend)));
        return;
    }
    // CASE 2: Level changed
    if (before.isActive && after.isActive && before.level !== after.level) {
        const prevLevelName = VERIFICATION_LEVEL_NAMES[before.level];
        const newLevelName = VERIFICATION_LEVEL_NAMES[after.level];
        await (0, notificationUtils_1.createNotificationForMultiple)(targets, {
            type: 'VERIFICATION_MODIFIED',
            message: `${verifierName} updated their verification on ${recordFallback} from ${prevLevelName} to ${newLevelName}.`,
            link: `/app/records/${after.recordId}`,
            payload: stripUndefined({
                recordId: after.recordId,
                recordHash: after.recordHash,
                verifierId: after.verifierId,
                newLevel: after.level,
                oldLevel: before.level,
                encryptedRecordTitle: after.encryptedRecordTitle,
                encryptedRecordTitleIv: after.encryptedRecordTitleIv,
            }),
        });
        await Promise.all(targets.map(uid => (0, emailUtils_1.sendEmailIfEnabled)(uid, 'VERIFICATION_MODIFIED', {
            subject: `${verifierName} updated their verification`,
            html: (0, credibilityEmailTemplates_1.buildVerificationModifiedHtml)(verifierName, recordFallback, after.recordId, prevLevelName, newLevelName),
            text: (0, credibilityEmailTemplates_1.buildVerificationModifiedText)(verifierName, recordFallback, after.recordId, prevLevelName, newLevelName),
        }, resend)));
    }
});
// ============================================================================
// TRIGGER 3: DISPUTES CREATED
// ============================================================================
exports.onDisputeWritten = (0, firestore_1.onDocumentCreated)({ document: 'disputes/{disputeId}', secrets: [resendKey] }, async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    if (data.chainStatus !== 'confirmed' || !data.isActive)
        return;
    const targets = await getRecordStakeholders(data.recordId, data.disputerId);
    if (targets.length === 0)
        return;
    const disputerName = await (0, notificationUtils_1.getUserDisplayName)(data.disputerId);
    const severityName = DISPUTE_SEVERITY_NAMES[data.severity];
    const recordFallback = `Record ${data.recordId.slice(0, 8)}...`;
    await (0, notificationUtils_1.createNotificationForMultiple)(targets, {
        type: 'DISPUTE_ADDED',
        message: `${disputerName} raised a ${severityName} dispute on ${recordFallback}.`,
        link: `/app/records/${data.recordId}`,
        payload: stripUndefined({
            recordId: data.recordId,
            recordHash: data.recordHash,
            disputerId: data.disputerId,
            severity: data.severity,
            culpability: data.culpability,
            encryptedRecordTitle: data.encryptedRecordTitle,
            encryptedRecordTitleIv: data.encryptedRecordTitleIv,
        }),
    });
    const resend = new resend_1.Resend(resendKey.value());
    await Promise.all(targets.map(uid => (0, emailUtils_1.sendEmailIfEnabled)(uid, 'DISPUTE_ADDED', {
        subject: `${disputerName} raised a dispute on a record you're connected to`,
        html: (0, credibilityEmailTemplates_1.buildDisputeAddedHtml)(disputerName, recordFallback, data.recordId, severityName),
        text: (0, credibilityEmailTemplates_1.buildDisputeAddedText)(disputerName, recordFallback, data.recordId, severityName),
    }, resend)));
    console.log(`✅ Dispute notifications sent to ${targets.length} stakeholder(s)`);
});
// ============================================================================
// TRIGGER 4: DISPUTES UPDATED
// ============================================================================
exports.onDisputeUpdated = (0, firestore_1.onDocumentUpdated)({ document: 'disputes/{disputeId}', secrets: [resendKey] }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    const targets = await getRecordStakeholders(after.recordId, after.disputerId);
    if (targets.length === 0)
        return;
    const disputerName = await (0, notificationUtils_1.getUserDisplayName)(after.disputerId);
    const recordFallback = `Record ${after.recordId.slice(0, 8)}...`;
    const resend = new resend_1.Resend(resendKey.value());
    // CASE 1: Retracted
    if (before.isActive && !after.isActive) {
        await (0, notificationUtils_1.createNotificationForMultiple)(targets, {
            type: 'DISPUTE_RETRACTED',
            message: `${disputerName} retracted their dispute on ${recordFallback}.`,
            link: `/app/records/${after.recordId}`,
            payload: stripUndefined({
                recordId: after.recordId,
                recordHash: after.recordHash,
                disputerId: after.disputerId,
                encryptedRecordTitle: after.encryptedRecordTitle,
                encryptedRecordTitleIv: after.encryptedRecordTitleIv,
            }),
        });
        await Promise.all(targets.map(uid => (0, emailUtils_1.sendEmailIfEnabled)(uid, 'DISPUTE_RETRACTED', {
            subject: `${disputerName} retracted their dispute`,
            html: (0, credibilityEmailTemplates_1.buildDisputeRetractedHtml)(disputerName, recordFallback, after.recordId),
            text: (0, credibilityEmailTemplates_1.buildDisputeRetractedText)(disputerName, recordFallback, after.recordId),
        }, resend)));
        return;
    }
    // CASE 2: Severity or culpability changed
    if (before.isActive &&
        after.isActive &&
        (before.severity !== after.severity || before.culpability !== after.culpability)) {
        const newSeverityName = DISPUTE_SEVERITY_NAMES[after.severity];
        await (0, notificationUtils_1.createNotificationForMultiple)(targets, {
            type: 'DISPUTE_MODIFIED',
            message: `${disputerName} updated their dispute on ${recordFallback}.`,
            link: `/app/records/${after.recordId}`,
            payload: stripUndefined({
                recordId: after.recordId,
                recordHash: after.recordHash,
                disputerId: after.disputerId,
                newSeverity: after.severity,
                newCulpability: after.culpability,
                oldSeverity: before.severity,
                oldCulpability: before.culpability,
                encryptedRecordTitle: after.encryptedRecordTitle,
                encryptedRecordTitleIv: after.encryptedRecordTitleIv,
            }),
        });
        await Promise.all(targets.map(uid => (0, emailUtils_1.sendEmailIfEnabled)(uid, 'DISPUTE_MODIFIED', {
            subject: `${disputerName} updated their dispute`,
            html: (0, credibilityEmailTemplates_1.buildDisputeModifiedHtml)(disputerName, recordFallback, after.recordId, newSeverityName),
            text: (0, credibilityEmailTemplates_1.buildDisputeModifiedText)(disputerName, recordFallback, after.recordId, newSeverityName),
        }, resend)));
    }
});
//# sourceMappingURL=credibilityNotificationTrigger.js.map