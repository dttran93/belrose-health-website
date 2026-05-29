// src/features/HomeDashboard/components/NotificationsWidget.tsx

/**
 * NotificationsWidget
 *
 * Shows the 3 most recent unread notifications.
 * Parent (HomeDashboard) controls visibility — only rendered when unreadCount > 0.
 *
 * Each notification links to its `link` field from Firestore.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Notification } from '@/features/Notifications/hooks/useNotifications';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_MAPPING } from '@belrose/shared';

interface NotificationsWidgetProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => Promise<void>;
}

function getNotificationLabel(type: Notification['type']): string {
  const category = NOTIFICATION_MAPPING[type];
  return NOTIFICATION_CATEGORIES[category]?.label ?? 'Notification';
}

export const NotificationsWidget: React.FC<NotificationsWidgetProps> = ({
  notifications,
  onMarkAsRead,
}) => {
  const navigate = useNavigate();

  const unread = notifications.filter(n => !n.read).slice(0, 3);

  if (unread.length === 0) return null;

  const handleClick = async (n: Notification) => {
    await onMarkAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="flex flex-col divide-y divide-border">
      {unread.map(n => (
        <button
          key={n.id}
          onClick={() => handleClick(n)}
          className="flex items-start gap-3 py-2.5 text-left hover:bg-muted/50 -mx-1 px-1 transition-colors"
        >
          {/* Unread dot */}
          <span className="mt-1.5 w-2 h-2 rounded-full bg-destructive flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {getNotificationLabel(n.type)}
            </p>
            <p className="text-xs text-muted-foreground truncate">{n.message}</p>
          </div>

          <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
            {formatDistanceToNow(n.createdAt.toDate(), { addSuffix: false })}
          </span>
        </button>
      ))}
    </div>
  );
};

export default NotificationsWidget;
