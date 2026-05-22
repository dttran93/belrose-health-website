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

// Derived from categories, pulls each key from the key/value pairs in the NOTIFICATION_CATEGORIES object to create a union type of all notification types
export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES;

// Derived from the categories, pulls each notification type from the nested notificationTypes arrays to create a union type of all notification types
export type NotificationType =
  (typeof NOTIFICATION_CATEGORIES)[NotificationCategory]['notificationTypes'][number];

// ======================================================================
// NOTIFICATION PREFERENCES
// ======================================================================

export interface ChannelPrefs {
  inApp: boolean;
  email: boolean;
}

// Preferences are built at the notificationType level, the lowest level of granularity. UI allows for categories to be toggled as well.
export type NotificationPrefs = Partial<Record<NotificationType, ChannelPrefs>>;

// All notifications are active by default. Object is only updated when the user changes the preference
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = Object.fromEntries(
  (Object.values(NOTIFICATION_CATEGORIES) as { notificationTypes: readonly string[] }[])
    .flatMap(cat => cat.notificationTypes)
    .map(type => [type, { inApp: true, email: true }])
) as NotificationPrefs;
