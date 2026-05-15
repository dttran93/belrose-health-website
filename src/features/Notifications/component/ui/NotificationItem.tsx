// src/features/Notifications/components/ui/NotificationItem.tsx

import React, { useEffect, useState } from 'react';
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
  Trash2,
  FileEdit,
} from 'lucide-react';
import { Notification } from '@/features/Notifications/hooks/useNotifications';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import { resolveNotificationTitle } from '../../services/resolveNotificationTitle';
import { NotificationType } from '@belrose/shared';

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

// Notification types that reference a record title needing decryption
const RECORD_TITLE_TYPES = new Set<NotificationType>(['RECORD_EDITED']);

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
    case 'REJECTION_ESCALATED':
      return {
        icon: <Globe className="w-5 h-5" />,
        iconBgColor: 'bg-complement-2/10',
        iconColor: 'text-complement-2',
      };
    case 'RECORD_EDITED':
      return {
        icon: <FileEdit className="w-5 h-5" />,
        iconBgColor: 'bg-complement-1/10',
        iconColor: 'text-complement-1',
      };
    case 'RECORD_DELETED':
      return {
        icon: <Trash2 className="w-5 h-5" />,
        iconBgColor: 'bg-complement-4/10',
        iconColor: 'text-complement-4',
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

  // Resolved display message — starts with the raw message, then substitutes
  // the decrypted record title once async resolution completes
  const [displayMessage, setDisplayMessage] = useState(notification.message);

  useEffect(() => {
    if (!RECORD_TITLE_TYPES.has(notification.type)) return;
    if (!('payload' in notification)) return;

    let cancelled = false;

    resolveNotificationTitle(notification.payload).then(title => {
      if (cancelled) return;
      // Replace the fallback placeholder with the real decrypted title
      setDisplayMessage(notification.message.replace(/Record [a-f0-9]{8}\.\.\./, title));
    });

    return () => {
      cancelled = true;
    };
  }, [notification]);

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
        relative flex items-start gap-4 p-4 cursor-pointer
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
          {displayMessage}
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
