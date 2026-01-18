// functions/src/notifications/notificationUtils.ts

/**
 * Shared Notification Utilities
 *
 * Contains types, helpers, and the core createNotification function
 * used by all notification triggers throughout the app.
 */

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { SubjectRejectionType } from '../notifications/triggers/subjectNotificationTrigger';

// ============================================================================
// TYPES
// ============================================================================

/**
 * All notification types across the app.
 * Add new types here as you build new features.
 */
export type NotificationType =
  // Subject-related
  | 'SUBJECT_REQUEST_RECEIVED'
  | 'SUBJECT_ACCEPTED'
  | 'REJECTION_PENDING_CREATOR_DECISION'
  | 'REJECTION_ACKNOWLEDGED'
  | 'REJECTION_PUBLICLY_LISTED'
  // Messaging (future)
  | 'NEW_MESSAGE'
  // Generic fallback
  | 'GENERIC_NOTIFICATION';

/**
 * Source services - identifies which feature triggered the notification.
 * Useful for filtering and analytics.
 */
export type SourceService = 'Subject' | 'Messaging' | 'System';

/**
 * The shape of a notification document in Firestore.
 * Stored at: users/{userId}/notifications/{notificationId}
 */
export interface NotificationDoc {
  type: NotificationType;
  sourceService: SourceService;
  message: string;
  read: boolean;
  createdAt: Timestamp;
  link: string;
  payload: NotificationPayload;
}

/**
 * Flexible payload that can hold context for any notification type.
 * Add new optional fields as needed for new features.
 */
export interface NotificationPayload {
  // Subject-related
  recordId: string;
  subjectId: string;
  requestId?: string;
  requestedBy?: string;
  requestedSubjectRole?: string;
  // Messaging (future)
  conversationId?: string;
  senderId?: string;
  publiclyListed?: boolean;
  rejectionType?: SubjectRejectionType;
  // Add more as needed...
}

export type CreateNotificationInput = Omit<NotificationDoc, 'createdAt' | 'read'>;

export function getFirestore() {
  return admin.firestore();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch a user's display name for notification messages.
 * Falls back gracefully if user doesn't exist or has no name set.
 *
 * @param userId - The Firebase Auth UID
 * @returns Display name, email, or truncated ID as fallback
 */
export async function getUserDisplayName(userId: string): Promise<string> {
  try {
    const userDoc = await getFirestore().collection('users').doc(userId).get();

    if (userDoc.exists) {
      const data = userDoc.data();
      return data?.displayName || data?.email || formatUserIdFallback(userId);
    }
  } catch (error) {
    console.warn(`⚠️ Could not fetch user name for ${userId}:`, error);
  }

  return formatUserIdFallback(userId);
}

/**
 * Format a user ID as a fallback display name
 */
function formatUserIdFallback(userId: string): string {
  return `User ${userId.slice(0, 8)}...`;
}

/**
 * Fetch a record's display name (fileName) for notification messages.
 *
 * @param recordId - The Firestore document ID
 * @returns File name or truncated ID as fallback
 */
export async function getRecordDisplayName(recordId: string): Promise<string> {
  try {
    const recordDoc = await getFirestore().collection('records').doc(recordId).get();

    if (recordDoc.exists) {
      const data = recordDoc.data();
      return data?.fileName || formatRecordIdFallback(recordId);
    }
  } catch (error) {
    console.warn(`⚠️ Could not fetch record name for ${recordId}:`, error);
  }

  return formatRecordIdFallback(recordId);
}

/**
 * Format a record ID as a fallback display name
 */
function formatRecordIdFallback(recordId: string): string {
  return `Record ${recordId.slice(0, 8)}...`;
}

// ============================================================================
// CORE NOTIFICATION FUNCTION
// ============================================================================

/**
 * Create a notification in a user's notification subcollection.
 *
 * This is the single source of truth for writing notifications.
 * All triggers should use this function.
 *
 * @param targetUserId - The user who will receive the notification
 * @param notification - The notification data (without createdAt/read)
 * @returns The created notification document ID
 */
export async function createNotification(
  targetUserId: string,
  notification: CreateNotificationInput
): Promise<string> {
  const notificationRef = getFirestore()
    .collection('users')
    .doc(targetUserId)
    .collection('notifications');

  const docRef = await notificationRef.add({
    ...notification,
    read: false,
    createdAt: admin.firestore.Timestamp.now(),
  });

  console.log(
    `✅ Notification created for user ${targetUserId}: ${notification.type} (${docRef.id})`
  );

  return docRef.id;
}

/**
 * Create notifications for multiple users with the same content.
 * Useful when notifying all owners/admins of a record.
 *
 * @param targetUserIds - Array of user IDs to notify
 * @param notification - The notification data
 * @returns Array of created notification document IDs
 */
export async function createNotificationForMultiple(
  targetUserIds: string[],
  notification: CreateNotificationInput
): Promise<string[]> {
  // Deduplicate user IDs
  const uniqueUserIds = [...new Set(targetUserIds)];

  const results = await Promise.all(
    uniqueUserIds.map(userId => createNotification(userId, notification))
  );

  return results;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Mark a notification as read.
 * Called from client-side when user views the notification.
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  await getFirestore()
    .collection('users')
    .doc(userId)
    .collection('notifications')
    .doc(notificationId)
    .update({ read: true });
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const notificationsRef = getFirestore()
    .collection('users')
    .doc(userId)
    .collection('notifications');

  const unreadDocs = await notificationsRef.where('read', '==', false).get();

  const batch = getFirestore().batch();
  unreadDocs.docs.forEach(doc => {
    batch.update(doc.ref, { read: true });
  });

  await batch.commit();
}

/**
 * Delete old notifications (for cleanup jobs).
 *
 * @param userId - The user whose notifications to clean
 * @param olderThanDays - Delete notifications older than this many days
 */
export async function deleteOldNotifications(
  userId: string,
  olderThanDays: number = 90
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const notificationsRef = getFirestore()
    .collection('users')
    .doc(userId)
    .collection('notifications');

  const oldDocs = await notificationsRef
    .where('createdAt', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
    .get();

  const batch = getFirestore().batch();
  oldDocs.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  return oldDocs.size;
}
