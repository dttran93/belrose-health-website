// src/features/Notifications/pages/NotificationsPage.tsx

import React, { useState, useMemo } from 'react';
import { Bell, BellOff, CheckCheck, Filter, Loader2, AlertCircle, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthContext } from '@/components/auth/AuthContext';
import { useNotifications, SourceService } from '../hooks/useNotifications';
import NotificationItem from './ui/NotificationItem';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

type FilterOption = 'all' | 'unread' | SourceService;

interface FilterButtonProps {
  label: string;
  value: FilterOption;
  activeFilter: FilterOption;
  onClick: (value: FilterOption) => void;
  count?: number;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Filter button component for notification filtering.
 */
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
          className={`
            ml-2 px-1.5 py-0.5 text-xs rounded-full
            ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-chart-1/10 text-chart-1'}
          `}
        >
          {count}
        </span>
      )}
    </button>
  );
};

/**
 * Empty state component shown when no notifications match the filter.
 */
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

/**
 * Loading state skeleton component.
 */
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

/**
 * Error state component.
 */
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Full-page notifications view.
 *
 * Displays all user notifications with filtering options,
 * mark all as read functionality, and real-time updates.
 *
 * Similar to Facebook's full notifications page experience.
 */
export const NotificationsManager: React.FC = () => {
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

  // Filter notifications based on active filter
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

  // Calculate counts for filter badges
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

  // Handle marking a single notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
    } catch {
      toast.error('Failed to mark notification as read');
    }
  };

  // Handle marking all notifications as read
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary">Notifications</h1>
                {unreadCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Mark all as read button */}
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={isMarkingAllRead}
                className="gap-2"
              >
                {isMarkingAllRead ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                Mark all as read
              </Button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto">
        {/* Loading State */}
        {loading && <LoadingSkeleton />}

        {/* Error State */}
        {error && !loading && <ErrorState onRetry={refreshNotifications} />}

        {/* Notifications List */}
        {!loading && !error && (
          <>
            {filteredNotifications.length === 0 ? (
              <EmptyState filter={activeFilter} />
            ) : (
              <div className="divide-y divide-border">
                {filteredNotifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Bottom Padding for mobile */}
        <div className="h-20" />
      </div>
    </div>
  );
};

export default NotificationsManager;
