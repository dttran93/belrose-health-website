// src/pages/ActivityHub.tsx

/**
 * ActivityHub
 *
 * Central page for user activity at /app/activity.
 * Two tabs:
 *   - Notifications: event-based alerts (things that happened)
 *   - Actions:       follow-up items across all records (things to do)
 *
 * Tab state is owned in the URL via ?tab= so tabs are deep-linkable
 * and the browser back button works naturally.
 */

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, ListChecks } from 'lucide-react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { useNotifications } from '@/features/Notifications/hooks/useNotifications';
import FollowUpActionsManager from '@/features/RefineRecord/components/FollowUpActionsManager';
import NotificationsManager from '@/features/Notifications/component/NotificationsManager';
import { useActionsCount } from '@/features/RefineRecord/hooks/useActionsCount';

// ── Tab config ────────────────────────────────────────────────────────────────

type TabId = 'notifications' | 'actions';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'actions', label: 'Actions', icon: ListChecks },
];

// ── Page ──────────────────────────────────────────────────────────────────────

const ActivityHub: React.FC = () => {
  const { user } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as TabId | null;
  const activeTab: TabId = tabParam === 'actions' ? 'actions' : 'notifications';

  const handleTabChange = (tab: TabId) => {
    setSearchParams({ tab }, { replace: true });
  };

  // Fetch unread count for the notifications badge
  const { unreadCount } = useNotifications(user?.uid);
  const { count: actionsCount } = useActionsCount();

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-0">
          <h1 className="text-2xl font-bold text-primary mb-4">Activity Hub</h1>

          {/* Tab bar */}
          <div className="flex gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const badge =
                tab.id === 'notifications' && unreadCount > 0
                  ? unreadCount
                  : tab.id === 'actions' && actionsCount > 0
                    ? actionsCount
                    : null;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    relative flex items-center gap-2 px-4 py-3 text-sm font-medium
                    border-b-2 transition-colors
                    ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {badge && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'notifications' && <NotificationsManager />}
      {activeTab === 'actions' && <FollowUpActionsManager />}
    </div>
  );
};

export default ActivityHub;
