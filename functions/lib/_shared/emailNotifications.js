"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_NOTIFICATION_PREFS = exports.NOTIFICATION_CATEGORIES = void 0;
exports.NOTIFICATION_CATEGORIES = {
    recordEditing: {
        label: 'Record Editing',
        description: 'Get notifications when your records are edited.',
    },
    recordDeletion: {
        label: 'Record Deletion',
        description: 'Get notifications when your records are deleted.',
    },
    subjectRequests: {
        label: 'Subject Requests',
        description: 'Get notifications when someone requests you as a subject or responds to your subject requests.',
    },
    permissions: {
        label: 'Permissions Changes',
        description: 'Get notifications when your permissions change on a record.',
    },
    credibility: {
        label: 'Credibility Updates',
        description: 'Get notifications when your verifications or disputes are made on your records.',
    },
    trustee: {
        label: 'Trustee Relationships',
        description: 'Get notifications regarding trustee relationship changes.',
    },
    recordRequests: {
        label: 'Record Requests',
        description: 'Get notifications when someone responds to your record requests.',
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
};
//# sourceMappingURL=emailNotifications.js.map