// src/features/Notifications/hooks/useNotifications.ts

import { useState, useEffect, useCallback } from 'react';
import { onSnapshot, QuerySnapshot, DocumentData, Timestamp } from 'firebase/firestore';
import { NotificationReader } from '@/features/Notifications/services/notificationReader';
import { NotificationCategory, NotificationType } from '@belrose/shared';

// ============================================================================
// TYPES
// ============================================================================

export interface Notification {
  id: string;
  type: NotificationType;
  sourceService: NotificationCategory;
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

    setLoading(true);
    setError(null);

    // Get the query from NotificationReader
    const notificationsQuery = NotificationReader.getInboxQuery(userId);

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const notificationsList: Notification[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type as NotificationType,
            sourceService: data.sourceService as NotificationCategory,
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
      unsubscribe();
    };
  }, [userId, refreshTrigger]);

  // Mark single notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;

      try {
        await NotificationReader.markAsRead(userId, notificationId);
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
