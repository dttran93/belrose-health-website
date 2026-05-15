export const NOTIFICATION_CATEGORIES = {
  recordEditing: {
    label: 'Record Editing',
    description: 'Get notifications when your records are edited.',
    notificationTypes: ['RECORD_EDITED'] as const,
  },
  recordDeletion: {
    label: 'Record Deletion',
    description: 'Get notifications when your records are deleted.',
    notificationTypes: ['RECORD_DELETED'] as const,
  },
  subjectRequests: {
    label: 'Subject Requests',
    description:
      'Get notifications when someone requests you as a subject or responds to your subject requests.',
    notificationTypes: [
      'SUBJECT_REQUEST_RECEIVED',
      'SUBJECT_ACCEPTED',
      'REJECTION_PENDING_CREATOR_DECISION',
      'REJECTION_ACKNOWLEDGED',
      'REJECTION_ESCALATED',
    ] as const,
  },
  permissions: {
    label: 'Permissions Changes',
    description: 'Get notifications when your permissions change on a record.',
    notificationTypes: ['PERMISSIONS_GRANTED', 'PERMISSIONS_REVOKED'] as const,
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
    ] as const,
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
    ] as const,
  },
  recordRequests: {
    label: 'Record Requests',
    description: 'Get notifications when someone responds to your record requests.',
    notificationTypes: [
      'RECORD_REQUEST_RECEIVED',
      'RECORD_REQUEST_VIEWED',
      'RECORD_REQUEST_FULFILLED',
      'RECORD_REQUEST_DENIED',
    ] as const,
  },
  system: {
    label: 'System Notifications',
    description: 'Get notifications about system updates and important announcements.',
    notificationTypes: ['GENERIC_NOTIFICATION'] as const,
  },
} as const;

export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES;

// Derived from the categories — single source of truth
export type NotificationType =
  (typeof NOTIFICATION_CATEGORIES)[NotificationCategory]['notificationTypes'][number];

// ======================================================================
// NOTIFICATION PREFERENCS
// ======================================================================

export interface ChannelPrefs {
  inApp: boolean;
  email: boolean;
}

export type NotificationPrefs = Record<NotificationCategory, ChannelPrefs>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  recordEditing: { inApp: true, email: true },
  recordDeletion: { inApp: true, email: true },
  subjectRequests: { inApp: true, email: true },
  permissions: { inApp: true, email: true },
  credibility: { inApp: true, email: true },
  trustee: { inApp: true, email: true },
  recordRequests: { inApp: true, email: true },
  system: { inApp: true, email: true },
};
