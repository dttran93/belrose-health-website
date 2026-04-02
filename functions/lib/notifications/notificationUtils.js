"use strict";
// functions/src/notifications/notificationUtils.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirestore = getFirestore;
exports.getUserDisplayName = getUserDisplayName;
exports.getRecordDisplayName = getRecordDisplayName;
exports.createNotification = createNotification;
exports.createNotificationForMultiple = createNotificationForMultiple;
exports.markNotificationAsRead = markNotificationAsRead;
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
exports.deleteOldNotifications = deleteOldNotifications;
/**
 * Shared Notification Utilities
 *
 * Contains types, helpers, and the core createNotification function
 * used by all notification triggers throughout the app.
 */
const admin = __importStar(require("firebase-admin"));
function getFirestore() {
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
async function getUserDisplayName(userId) {
    try {
        const userDoc = await getFirestore().collection('users').doc(userId).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            return data?.displayName || data?.email || formatUserIdFallback(userId);
        }
    }
    catch (error) {
        console.warn(`⚠️ Could not fetch user name for ${userId}:`, error);
    }
    return formatUserIdFallback(userId);
}
/**
 * Format a user ID as a fallback display name
 */
function formatUserIdFallback(userId) {
    return `User ${userId.slice(0, 8)}...`;
}
/**
 * Fetch a record's display name (fileName) for notification messages.
 *
 * @param recordId - The Firestore document ID
 * @returns File name or truncated ID as fallback
 */
async function getRecordDisplayName(recordId) {
    try {
        const recordDoc = await getFirestore().collection('records').doc(recordId).get();
        if (recordDoc.exists) {
            const data = recordDoc.data();
            return data?.fileName || formatRecordIdFallback(recordId);
        }
    }
    catch (error) {
        console.warn(`⚠️ Could not fetch record name for ${recordId}:`, error);
    }
    return formatRecordIdFallback(recordId);
}
/**
 * Format a record ID as a fallback display name
 */
function formatRecordIdFallback(recordId) {
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
async function createNotification(targetUserId, notification) {
    const notificationRef = getFirestore()
        .collection('users')
        .doc(targetUserId)
        .collection('notifications');
    const docRef = await notificationRef.add({
        ...notification,
        read: false,
        createdAt: admin.firestore.Timestamp.now(),
    });
    console.log(`✅ Notification created for user ${targetUserId}: ${notification.type} (${docRef.id})`);
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
async function createNotificationForMultiple(targetUserIds, notification) {
    // Deduplicate user IDs
    const uniqueUserIds = [...new Set(targetUserIds)];
    const results = await Promise.all(uniqueUserIds.map(userId => createNotification(userId, notification)));
    return results;
}
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Mark a notification as read.
 * Called from client-side when user views the notification.
 */
async function markNotificationAsRead(userId, notificationId) {
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
async function markAllNotificationsAsRead(userId) {
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
async function deleteOldNotifications(userId, olderThanDays = 90) {
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
//# sourceMappingURL=notificationUtils.js.map