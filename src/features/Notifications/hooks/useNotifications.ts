// src/features/Notifications/hooks/useNotifications.ts

import { useState, useEffect, useCallback } from 'react';
import { onSnapshot, QuerySnapshot, DocumentData, Timestamp } from 'firebase/firestore';
import { NotificationReader } from '@/features/Notifications/services/notificationReader';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType =
  | 'SUBJECT_REQUEST_RECEIVED'
  | 'SUBJECT_ACCEPTED'
  | 'REJECTION_PENDING_CREATOR_DECISION'
  | 'REJECTION_ACKNOWLEDGED'
  | 'REJECTION_PUBLICLY_LISTED'
  | 'NEW_MESSAGE'
  | 'GENERIC_NOTIFICATION';

export type SourceService = 'Subject' | 'Messaging' | 'System';

export interface Notification {
  id: string;
  type: NotificationType;
  sourceService: SourceService;
  message: string;
  read: boolean;
  createdAt: Timestamp;
  link: string;
  payload: {
    recordId?: string;
    subjectId?: string;
    requestedBy?: string;
    conversationId?: string;
    senderId?: string;
  };
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Custom hook for managing notifications with real-time Firestore updates.
 *
 * This hook sets up a real-time listener on the user's notifications subcollection
 * and provides methods for marking notifications as read.
 *
 * @param userId - The Firebase Auth UID of the current user
 * @returns Notifications data and helper functions
 */
export const useNotifications = (userId: string | undefined): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Calculate unread count from notifications
  const unreadCount = notifications.filter(n => !n.read).length;

  // Force refresh function
  const refreshNotifications = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Set up real-time listener
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    console.log('🔔 Setting up notifications listener for user:', userId);
    setLoading(true);
    setError(null);

    // Get the query from NotificationReader
    const notificationsQuery = NotificationReader.getInboxQuery(userId);

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        console.log(`📬 Received ${snapshot.docs.length} notifications`);

        const notificationsList: Notification[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type as NotificationType,
            sourceService: data.sourceService as SourceService,
            message: data.message,
            read: data.read ?? false,
            createdAt: data.createdAt,
            link: data.link,
            payload: data.payload ?? {},
          };
        });

        setNotifications(notificationsList);
        setLoading(false);
      },
      err => {
        console.error('❌ Error fetching notifications:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('🔕 Cleaning up notifications listener');
      unsubscribe();
    };
  }, [userId, refreshTrigger]);

  // Mark single notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;

      try {
        await NotificationReader.markAsRead(userId, notificationId);
        console.log(`✅ Marked notification ${notificationId} as read`);
      } catch (err) {
        console.error('❌ Failed to mark notification as read:', err);
        throw err;
      }
    },
    [userId]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      // Get all unread notification IDs
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);

      // Mark each as read (in parallel)
      await Promise.all(unreadIds.map(id => NotificationReader.markAsRead(userId, id)));

      console.log(`✅ Marked ${unreadIds.length} notifications as read`);
    } catch (err) {
      console.error('❌ Failed to mark all notifications as read:', err);
      throw err;
    }
  }, [userId, notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  };
};

export default useNotifications;
