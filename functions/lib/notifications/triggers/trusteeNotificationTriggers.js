"use strict";
/**
 * Trustee Notification Trigger
 *
 * Watches trusteeRelationships for creates and updates.
 *
 * One trigger covers all cases — the relationship doc is the source of truth.
 *
 * Who gets notified:
 * - Invite created (pending)    → trustee
 * - Accepted (active)           → trustor
 * - Declined                    → trustor
 * - Revoked by trustor          → trustee
 * - Resigned by trustee         → trustor
 * - Trust level edited          → trustee
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onTrusteeRelationshipUpdated = exports.onTrusteeRelationshipCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const resend_1 = require("resend");
const params_1 = require("firebase-functions/params");
const notificationUtils_1 = require("../notificationUtils");
const emailUtils_1 = require("../emailUtils");
const trusteeEmailTemplates_1 = require("../emails/trusteeEmailTemplates");
// ============================================================================
// CONSTANTS
// ============================================================================
const resendKey = (0, params_1.defineSecret)('RESEND_API_KEY');
const TRUST_LEVEL_LABELS = {
    observer: 'Observer',
    custodian: 'Custodian',
    controller: 'Controller',
};
const TRUST_LEVEL_DESCRIPTIONS = {
    observer: "You have read-only access to the trustor's records",
    custodian: "You have management access to the trustor's records",
    controller: 'You have full account-level permissions including accepting, deleting records on their behalf',
};
// ============================================================================
// TRIGGER 1: INVITE CREATED
// ============================================================================
exports.onTrusteeRelationshipCreated = (0, firestore_1.onDocumentCreated)({ document: 'trusteeRelationships/{relationshipId}', secrets: [resendKey] }, async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    // Only fire on new pending invites
    if (data.status !== 'pending')
        return;
    const trustorName = await (0, notificationUtils_1.getUserDisplayName)(data.trustorId);
    const levelLabel = TRUST_LEVEL_LABELS[data.trustLevel];
    const levelDescription = TRUST_LEVEL_DESCRIPTIONS[data.trustLevel];
    // Notify the trustee
    await (0, notificationUtils_1.createNotification)(data.trusteeId, {
        type: 'TRUSTEE_INVITE_RECEIVED',
        message: `${trustorName} has invited you to be their ${levelLabel} trustee.`,
        link: '/app/settings/trustees',
        payload: {
            trustorId: data.trustorId,
            trusteeId: data.trusteeId,
            trustLevel: data.trustLevel,
        },
    });
    const resend = new resend_1.Resend(resendKey.value());
    await (0, emailUtils_1.sendEmailIfEnabled)(data.trusteeId, 'TRUSTEE_INVITE_RECEIVED', {
        subject: `${trustorName} has invited you to be their trustee`,
        html: (0, trusteeEmailTemplates_1.buildTrusteeInvitedHtml)(trustorName, levelLabel, levelDescription),
        text: (0, trusteeEmailTemplates_1.buildTrusteeInvitedText)(trustorName, levelLabel, levelDescription),
    }, resend);
    console.log(`✅ Trustee invite notification sent to ${data.trusteeId}`);
});
// ============================================================================
// TRIGGER 2: RELATIONSHIP UPDATED
// ============================================================================
exports.onTrusteeRelationshipUpdated = (0, firestore_1.onDocumentUpdated)({ document: 'trusteeRelationships/{relationshipId}', secrets: [resendKey] }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    const resend = new resend_1.Resend(resendKey.value());
    // CASE 1: Accepted — pending → active
    if (before.status === 'pending' && after.status === 'active') {
        const trusteeName = await (0, notificationUtils_1.getUserDisplayName)(after.trusteeId);
        const levelLabel = TRUST_LEVEL_LABELS[after.trustLevel];
        await (0, notificationUtils_1.createNotification)(after.trustorId, {
            type: 'TRUSTEE_INVITE_ACCEPTED',
            message: `${trusteeName} accepted your trustee invite as ${levelLabel}.`,
            link: '/app/settings/trustees',
            payload: {
                trustorId: after.trustorId,
                trusteeId: after.trusteeId,
                trustLevel: after.trustLevel,
            },
        });
        await (0, emailUtils_1.sendEmailIfEnabled)(after.trustorId, 'TRUSTEE_INVITE_ACCEPTED', {
            subject: `${trusteeName} accepted your trustee invite`,
            html: (0, trusteeEmailTemplates_1.buildTrusteeAcceptedHtml)(trusteeName, levelLabel),
            text: (0, trusteeEmailTemplates_1.buildTrusteeAcceptedText)(trusteeName, levelLabel),
        }, resend);
        console.log(`✅ Trustee accepted notification sent to trustor ${after.trustorId}`);
        return;
    }
    // CASE 2: Declined — pending → declined
    if (before.status === 'pending' && after.status === 'declined') {
        const trusteeName = await (0, notificationUtils_1.getUserDisplayName)(after.trusteeId);
        const levelLabel = TRUST_LEVEL_LABELS[after.trustLevel];
        await (0, notificationUtils_1.createNotification)(after.trustorId, {
            type: 'TRUSTEE_INVITE_DECLINED',
            message: `${trusteeName} declined your trustee invite.`,
            link: '/app/settings/trustees',
            payload: {
                trustorId: after.trustorId,
                trusteeId: after.trusteeId,
                trustLevel: after.trustLevel,
            },
        });
        await (0, emailUtils_1.sendEmailIfEnabled)(after.trustorId, 'TRUSTEE_INVITE_DECLINED', {
            subject: `${trusteeName} declined your trustee invite`,
            html: (0, trusteeEmailTemplates_1.buildTrusteeDeclinedHtml)(trusteeName, levelLabel),
            text: (0, trusteeEmailTemplates_1.buildTrusteeDeclinedText)(trusteeName, levelLabel),
        }, resend);
        console.log(`✅ Trustee declined notification sent to trustor ${after.trustorId}`);
        return;
    }
    // CASE 3: Revoked or resigned — active/pending → revoked
    if (before.status !== 'revoked' && after.status === 'revoked') {
        const levelLabel = TRUST_LEVEL_LABELS[after.trustLevel];
        const isTrusteeResigned = after.statusUpdateReason === 'trustee_resigned';
        if (isTrusteeResigned) {
            // Notify trustor that their trustee resigned
            const trusteeName = await (0, notificationUtils_1.getUserDisplayName)(after.trusteeId);
            await (0, notificationUtils_1.createNotification)(after.trustorId, {
                type: 'TRUSTEE_RESIGNED',
                message: `${trusteeName} has resigned as your ${levelLabel} trustee.`,
                link: '/app/settings/trustees',
                payload: {
                    trustorId: after.trustorId,
                    trusteeId: after.trusteeId,
                    trustLevel: after.trustLevel,
                },
            });
            await (0, emailUtils_1.sendEmailIfEnabled)(after.trustorId, 'TRUSTEE_RESIGNED', {
                subject: `${trusteeName} has resigned as your trustee`,
                html: (0, trusteeEmailTemplates_1.buildTrusteeResignedHtml)(trusteeName, levelLabel),
                text: (0, trusteeEmailTemplates_1.buildTrusteeResignedText)(trusteeName, levelLabel),
            }, resend);
            console.log(`✅ Trustee resigned notification sent to trustor ${after.trustorId}`);
        }
        else {
            // Notify trustee that they were revoked
            const trustorName = await (0, notificationUtils_1.getUserDisplayName)(after.trustorId);
            await (0, notificationUtils_1.createNotification)(after.trusteeId, {
                type: 'TRUSTEE_REVOKED',
                message: `${trustorName} has revoked your ${levelLabel} trustee access.`,
                link: '/app/settings/trustees',
                payload: {
                    trustorId: after.trustorId,
                    trusteeId: after.trusteeId,
                    trustLevel: after.trustLevel,
                },
            });
            await (0, emailUtils_1.sendEmailIfEnabled)(after.trusteeId, 'TRUSTEE_REVOKED', {
                subject: `Your trustee access has been revoked`,
                html: (0, trusteeEmailTemplates_1.buildTrusteeRevokedHtml)(trustorName, levelLabel),
                text: (0, trusteeEmailTemplates_1.buildTrusteeRevokedText)(trustorName, levelLabel),
            }, resend);
            console.log(`✅ Trustee revoked notification sent to trustee ${after.trusteeId}`);
        }
        return;
    }
    // CASE 4: Trust level changed — active → active, different trustLevel
    if (before.status === 'active' &&
        after.status === 'active' &&
        before.trustLevel !== after.trustLevel) {
        const trustorName = await (0, notificationUtils_1.getUserDisplayName)(after.trustorId);
        const prevLabel = TRUST_LEVEL_LABELS[before.trustLevel];
        const newLabel = TRUST_LEVEL_LABELS[after.trustLevel];
        const newDescription = TRUST_LEVEL_DESCRIPTIONS[after.trustLevel];
        const isUpgrade = after.statusUpdateReason === 'trust_level_upgrade';
        await (0, notificationUtils_1.createNotification)(after.trusteeId, {
            type: 'TRUSTEE_LEVEL_CHANGED',
            message: `${trustorName} ${isUpgrade ? 'upgraded' : 'changed'} your trustee level from ${prevLabel} to ${newLabel}.`,
            link: '/app/settings/trustees',
            payload: {
                trustorId: after.trustorId,
                trusteeId: after.trusteeId,
                trustLevel: after.trustLevel,
                previousTrustLevel: before.trustLevel,
            },
        });
        await (0, emailUtils_1.sendEmailIfEnabled)(after.trusteeId, 'TRUSTEE_LEVEL_CHANGED', {
            subject: `Your trustee level has been ${isUpgrade ? 'upgraded' : 'changed'}`,
            html: (0, trusteeEmailTemplates_1.buildTrusteeLevelChangedHtml)(trustorName, prevLabel, newLabel, newDescription, isUpgrade),
            text: (0, trusteeEmailTemplates_1.buildTrusteeLevelChangedText)(trustorName, prevLabel, newLabel, isUpgrade),
        }, resend);
        console.log(`✅ Trustee level change notification sent to trustee ${after.trusteeId}`);
    }
});
//# sourceMappingURL=trusteeNotificationTriggers.js.map