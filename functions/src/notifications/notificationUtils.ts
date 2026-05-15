// functions/src/notifications/notificationUtils.ts

/**
 * Shared Notification Utilities
 *
 * Contains types, helpers, and the core createNotification function
 * used by all notification triggers throughout the app.
 *
 * - NotificationDoc is a discriminated union — each type has its own
 *   payload shape, giving full type safety at every call site.
 * - SourceService is derived automatically from NotificationType via
 *   NOTIFICATION_SOURCE — callers never pass it explicitly.
 */

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { SubjectRejectionType } from '../notifications/triggers/subjectNotificationTrigger';
import { NOTIFICATION_CATEGORIES, NotificationCategory } from '@/_shared';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Flexible payload that can holds context for any notification type.
 */
export type NotificationDoc =
  // ── Record editing ────────────────────────────────────────────────────────
  | {
      type: 'RECORD_EDITED';
      payload: {
        recordId: string;
        versionId: string;
        versionNumber: number;
        editedBy: string;
        encryptedRecordTitle?: string;
        encryptedRecordTitleIv?: string;
      };
    }

  // ── Subject requests ──────────────────────────────────────────────────────
  | {
      type: 'SUBJECT_REQUEST_RECEIVED';
      payload: {
        recordId: string;
        requestId: string;
        subjectId: string;
        requestedBy: string;
        requestedSubjectRole: 'viewer' | 'administrator' | 'owner';
      };
    }
  | {
      type: 'SUBJECT_ACCEPTED';
      payload: {
        recordId: string;
        requestId: string;
        subjectId: string;
      };
    }
  | {
      type: 'REJECTION_PENDING_CREATOR_DECISION';
      payload: {
        recordId: string;
        requestId: string;
        subjectId: string;
        rejectionType: SubjectRejectionType;
      };
    }
  | {
      type: 'REJECTION_ACKNOWLEDGED';
      payload: {
        recordId: string;
        requestId: string;
        subjectId: string;
      };
    }
  | {
      type: 'REJECTION_ESCALATED';
      payload: {
        recordId: string;
        requestId: string;
        subjectId: string;
      };
    }

  // ── Record deletion ───────────────────────────────────────────────────────
  | {
      type: 'RECORD_DELETED';
      payload: {
        recordId: string;
        deletedBy: string;
      };
    }

  // ── Record requests ───────────────────────────────────────────────────────
  | {
      type: 'RECORD_REQUEST_RECEIVED';
      payload: {
        requestId: string;
        requestedBy: string;
      };
    }
  | {
      type: 'RECORD_REQUEST_VIEWED';
      payload: {
        requestId: string;
      };
    }
  | {
      type: 'RECORD_REQUEST_FULFILLED';
      payload: {
        requestId: string;
        recordIds: string[];
      };
    }
  | {
      type: 'RECORD_REQUEST_DENIED';
      payload: {
        requestId: string;
        deniedReason?: string;
      };
    }

  // ── Generic fallback ──────────────────────────────────────────────────────
  | {
      type: 'GENERIC_NOTIFICATION';
      payload: Record<string, unknown>;
    };

export type NotificationType = NotificationDoc['type'];

export const NOTIFICATION_MAPPING = Object.fromEntries(
  Object.entries(NOTIFICATION_CATEGORIES).flatMap(([category, { notificationTypes }]) =>
    notificationTypes.map(type => [type, category])
  )
) as Record<NotificationType, NotificationCategory>;

export type CreateNotificationInput = NotificationDoc & {
  message: string;
  link: string;
};

// What actually gets stored — createNotification adds the rest
export type StoredNotificationDoc = CreateNotificationInput & {
  sourceService: NotificationCategory;
  read: boolean;
  createdAt: Timestamp;
};

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
  const stored: StoredNotificationDoc = {
    ...notification,
    sourceService: NOTIFICATION_MAPPING[notification.type],
    read: false,
    createdAt: admin.firestore.Timestamp.now(),
  };

  const docRef = await getFirestore()
    .collection('users')
    .doc(targetUserId)
    .collection('notifications')
    .add(stored);

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
