// src/features/Notifications/pages/NotificationsTab.tsx

/**
 * NotificationsTab
 *
 * The notifications content extracted from the old NotificationsManager page,
 * now used as the "Notifications" tab inside ActivityHub.
 *
 * The page-level chrome (header, sticky positioning) is owned by ActivityHub.
 * This component only renders the filter bar + notification list.
 */

import React, { useState, useMemo } from 'react';
import { Bell, CheckCheck, Filter, Loader2, AlertCircle, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { useNotifications, SourceService } from '../hooks/useNotifications';
import NotificationItem from './ui/NotificationItem';
import { toast } from 'sonner';

type FilterOption = 'all' | 'unread' | SourceService;

interface FilterButtonProps {
  label: string;
  value: FilterOption;
  activeFilter: FilterOption;
  onClick: (value: FilterOption) => void;
  count?: number;
}

const FilterButton: React.FC<FilterButtonProps> = ({
  label,
  value,
  activeFilter,
  onClick,
  count,
}) => {
  const isActive = activeFilter === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`
        px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
        ${
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
        }
      `}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-complement-1/10 text-complement-1'}`}
        >
          {count}
        </span>
      )}
    </button>
  );
};

const EmptyState: React.FC<{ filter: FilterOption }> = ({ filter }) => {
  const getMessage = () => {
    switch (filter) {
      case 'unread':
        return "You're all caught up! No unread notifications.";
      case 'Subject':
        return 'No subject-related notifications yet.';
      case 'Messaging':
        return 'No message notifications yet.';
      case 'System':
        return 'No system notifications yet.';
      default:
        return "You don't have any notifications yet.";
    }
  };
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Inbox className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">No notifications</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm">{getMessage()}</p>
    </div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-3 p-4">
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className="flex items-start gap-4 p-4 rounded-lg animate-pulse">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/4" />
        </div>
      </div>
    ))}
  </div>
);

const ErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
      <AlertCircle className="w-8 h-8 text-red-600" />
    </div>
    <h3 className="text-lg font-medium text-foreground mb-2">Failed to load notifications</h3>
    <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
      We couldn't load your notifications. Please try again.
    </p>
    <Button variant="outline" onClick={onRetry}>
      Try Again
    </Button>
  </div>
);

export const NotificationsTab: React.FC = () => {
  const { user } = useAuthContext();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  } = useNotifications(user?.uid);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case 'unread':
        return notifications.filter(n => !n.read);
      case 'Subject':
      case 'Messaging':
      case 'System':
        return notifications.filter(n => n.sourceService === activeFilter);
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  const filterCounts = useMemo(
    () => ({
      all: notifications.length,
      unread: unreadCount,
      Subject: notifications.filter(n => n.sourceService === 'Subject').length,
      Messaging: notifications.filter(n => n.sourceService === 'Messaging').length,
      System: notifications.filter(n => n.sourceService === 'System').length,
    }),
    [notifications, unreadCount]
  );

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    setIsMarkingAllRead(true);
    try {
      await markAllAsRead();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Sub-header: filter bar + mark all read */}
      <div className="px-4 py-4 flex items-center justify-between gap-4 border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0 mr-1" />
          <FilterButton
            label="All"
            value="all"
            activeFilter={activeFilter}
            onClick={setActiveFilter}
          />
          <FilterButton
            label="Unread"
            value="unread"
            activeFilter={activeFilter}
            onClick={setActiveFilter}
            count={filterCounts.unread}
          />
          <FilterButton
            label="Subject"
            value="Subject"
            activeFilter={activeFilter}
            onClick={setActiveFilter}
          />
          <FilterButton
            label="Messages"
            value="Messaging"
            activeFilter={activeFilter}
            onClick={setActiveFilter}
          />
          <FilterButton
            label="System"
            value="System"
            activeFilter={activeFilter}
            onClick={setActiveFilter}
          />
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAllRead}
            className="gap-2 flex-shrink-0"
          >
            {isMarkingAllRead ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            Mark all read
          </Button>
        )}
      </div>

      {/* Content */}
      {loading && <LoadingSkeleton />}
      {error && !loading && <ErrorState onRetry={refreshNotifications} />}
      {!loading &&
        !error &&
        (filteredNotifications.length === 0 ? (
          <EmptyState filter={activeFilter} />
        ) : (
          <div className="divide-y divide-border">
            {filteredNotifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
              />
            ))}
          </div>
        ))}

      <div className="h-20" />
    </div>
  );
};

export default NotificationsTab;
