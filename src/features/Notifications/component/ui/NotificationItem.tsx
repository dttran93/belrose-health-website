// src/features/Notifications/components/ui/NotificationItem.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  Globe,
  MessageSquare,
  Bell,
  Circle,
} from 'lucide-react';
import { Notification, NotificationType } from '@/features/Notifications/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { Timestamp } from 'firebase/firestore';
import { formatTimestamp } from '@/utils/dataFormattingUtils';

// ============================================================================
// TYPES
// ============================================================================

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}

interface NotificationConfig {
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
}

// ============================================================================
// NOTIFICATION CONFIG
// ============================================================================

/**
 * Configuration for each notification type.
 * Maps notification types to their visual appearance.
 */
const getNotificationConfig = (type: NotificationType): NotificationConfig => {
  switch (type) {
    case 'SUBJECT_REQUEST_RECEIVED':
      return {
        icon: <UserPlus className="w-5 h-5" />,
        iconBgColor: 'bg-complement-1/10',
        iconColor: 'text-complement-1',
      };
    case 'SUBJECT_ACCEPTED':
      return {
        icon: <UserCheck className="w-5 h-5" />,
        iconBgColor: 'bg-complement-3/10',
        iconColor: 'text-complement-3',
      };
    case 'REJECTION_PENDING_CREATOR_DECISION':
      return {
        icon: <AlertTriangle className="w-5 h-5" />,
        iconBgColor: 'bg-complement-4/10',
        iconColor: 'text-complement-4',
      };
    case 'REJECTION_ACKNOWLEDGED':
      return {
        icon: <CheckCircle className="w-5 h-5" />,
        iconBgColor: 'bg-supplement-4/10',
        iconColor: 'text-supplement-4',
      };
    case 'REJECTION_PUBLICLY_LISTED':
      return {
        icon: <Globe className="w-5 h-5" />,
        iconBgColor: 'bg-complement-2/10',
        iconColor: 'text-complement-2',
      };
    case 'NEW_MESSAGE':
      return {
        icon: <MessageSquare className="w-5 h-5" />,
        iconBgColor: 'bg-complement-5/10',
        iconColor: 'text-complement-5',
      };
    default:
      return {
        icon: <Bell className="w-5 h-5" />,
        iconBgColor: 'bg-muted',
        iconColor: 'text-muted-foreground',
      };
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Individual notification item component.
 *
 * Displays a notification with appropriate icon, message, and timestamp.
 * Handles click to navigate and mark as read.
 */
export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
}) => {
  const navigate = useNavigate();
  const config = getNotificationConfig(notification.type);

  const handleClick = () => {
    // Mark as read if unread
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }

    // Navigate to the linked page
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        relative flex items-start gap-4 p-4 rounded-lg cursor-pointer
        transition-all duration-200 ease-in-out
        hover:bg-muted/50
        ${notification.read ? 'bg-background' : 'bg-secondary/30'}
      `}
    >
      {/* Unread indicator dot */}
      {!notification.read && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          <Circle className="w-2 h-2 fill-complement-1 text-complement-1" />
        </div>
      )}

      {/* Icon */}
      <div
        className={`
          flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
          ${config.iconBgColor} ${config.iconColor}
          ${!notification.read ? 'ml-2' : ''}
        `}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`
            text-sm leading-relaxed
            ${notification.read ? 'text-foreground/80' : 'text-foreground font-medium'}
          `}
        >
          {notification.message}
        </p>

        {/* Timestamp and source */}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(notification.createdAt)}
          </span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground capitalize">
            {notification.sourceService}
          </span>
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
