// features/notifications/services/notificationService.ts (Refined)

import { getFirestore, collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';

export class NotificationReader {
  /**
   * Gets the real-time query reference for the current user's inbox.
   * This is used by the UI to listen for new notifications.
   */
  static getInboxQuery(userId: string) {
    const db = getFirestore();
    const ref = collection(db, 'users', userId, 'notifications');
    return query(ref, orderBy('createdAt', 'desc'));
  }

  /**
   * Marks a specific notification as read.
   */
  static async markAsRead(userId: string, notificationId: string): Promise<void> {
    const db = getFirestore();
    const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
    await updateDoc(notificationRef, { read: true });
  }
}
