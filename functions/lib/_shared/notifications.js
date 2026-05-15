"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_NOTIFICATION_PREFS = exports.NOTIFICATION_CATEGORIES = void 0;
exports.NOTIFICATION_CATEGORIES = {
    recordEditing: {
        label: 'Record Editing',
        description: 'Get notifications when your records are edited.',
        notificationTypes: ['RECORD_EDITED'],
    },
    recordDeletion: {
        label: 'Record Deletion',
        description: 'Get notifications when your records are deleted.',
        notificationTypes: ['RECORD_DELETED'],
    },
    subjectRequests: {
        label: 'Subject Requests',
        description: 'Get notifications when someone requests you as a subject or responds to your subject requests.',
        notificationTypes: [
            'SUBJECT_REQUEST_RECEIVED',
            'SUBJECT_ACCEPTED',
            'REJECTION_PENDING_CREATOR_DECISION',
            'REJECTION_ACKNOWLEDGED',
            'REJECTION_ESCALATED',
        ],
    },
    permissions: {
        label: 'Permissions Changes',
        description: 'Get notifications when your permissions change on a record.',
        notificationTypes: ['PERMISSIONS_GRANTED', 'PERMISSIONS_REVOKED'],
    },
    credibility: {
        label: 'Credibility Updates',
        description: 'Get notifications when your verifications or disputes are made on your records.',
        notificationTypes: [
            'VERIFICATION_ADDED',
            'VERIFICATION_MODIFIED',
            'VERIFICATION_RETRACTED',
            'DISPUTE_ADDED',
            'DISPUTE_MODIFIED',
            'DISPUTE_RETRACTED',
            'DISPUTE_REACTION_ADDED',
            'DISPUTE_REACTION_MODIFIED',
            'DISPUTE_REACTION_RETRACTED',
        ],
    },
    trustee: {
        label: 'Trustee Relationships',
        description: 'Get notifications regarding trustee relationship changes.',
        notificationTypes: [
            'TRUSTEE_INVITE_RECEIVED',
            'TRUSTEE_INVITE_ACCEPTED',
            'TRUSTEE_INVITE_DECLINED',
            'TRUSTEE_REVOKED',
            'TRUSTEE_RESIGNED',
            'TRUSTEE_LEVEL_CHANGED',
        ],
    },
    recordRequests: {
        label: 'Record Requests',
        description: 'Get notifications when someone responds to your record requests.',
        notificationTypes: [
            'RECORD_REQUEST_RECEIVED',
            'RECORD_REQUEST_VIEWED',
            'RECORD_REQUEST_FULFILLED',
            'RECORD_REQUEST_DENIED',
        ],
    },
    system: {
        label: 'System Notifications',
        description: 'Get notifications about system updates and important announcements.',
        notificationTypes: ['GENERIC_NOTIFICATION'],
    },
};
exports.DEFAULT_NOTIFICATION_PREFS = {
    recordEditing: { inApp: true, email: true },
    recordDeletion: { inApp: true, email: true },
    subjectRequests: { inApp: true, email: true },
    permissions: { inApp: true, email: true },
    credibility: { inApp: true, email: true },
    trustee: { inApp: true, email: true },
    recordRequests: { inApp: true, email: true },
    system: { inApp: true, email: true },
};
//# sourceMappingURL=notifications.js.map