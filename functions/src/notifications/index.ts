// functions/src/notifications/index.ts

/**
 * Notifications Module
 *
 * Central export point for all notification-related functionality.
 *
 * Structure:
 * - notificationUtils.ts  → Shared types, helpers, createNotification()
 * - triggers/             → Firestore triggers for each feature
 *   - subjectNotificationTrigger.ts
 *   - (future) messagingNotificationTrigger.ts
 *   - (future) recordNotificationTrigger.ts
 */

// Export shared utilities (for use in other parts of your codebase)
export {
  // Types
  NotificationType,
  SourceService,
  NotificationDoc,
  NotificationPayload,
  CreateNotificationInput,
  // Functions
  createNotification,
  createNotificationForMultiple,
  getUserDisplayName,
  getRecordDisplayName,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteOldNotifications,
} from './notificationUtils';

// Export triggers (for Firebase Functions deployment)
export { onRecordSubjectChange } from './triggers/subjectNotificationTrigger';
