// src/pages/HomeDashboard.tsx

/**
 * HomeDashboard  —  /app
 *
 * The main landing page after login. Replaces AppPortal as the /app route.
 * AppPortal moves to /app/ai (renamed AIPortal.tsx).
 *
 * Layout:
 *  - Greeting header
 *  - GettingStartedWidget (full-width, collapses once complete)
 *  - Stat pills (record count, open requests, unread messages) — returning users
 *  - 2-column grid:
 *      Left:  AIQuickAskWidget (always)
 *      Right: RequestsWidget (always, empty state if none)
 *  - 2-column grid (conditional):
 *      Left:  NotificationsWidget (only if unreadCount > 0)
 *      Right: MessagesWidget     (only if unreadMessages > 0)
 */

import React, { useEffect, useState } from 'react';
import { Bell, FileSearch, MessageSquare } from 'lucide-react';

import { useAuthContext } from '@/features/Auth/AuthContext';
import useNotifications from '@/features/Notifications/hooks/useNotifications';
import { useUnreadMessageCount } from '@/features/Messaging/hooks/useUnreadMessageCount';
import { useRecordRequests } from '@/features/RequestRecord/hooks/useRecordRequests';
import { getAccessibleRecords } from '@/features/Ai/service/recordContextService';

import { GettingStartedWidget } from '@/features/HomeDashboard/components/GettingStartedWidget';
import { MessagesWidget } from '@/features/HomeDashboard/components/MessagesWidget';
import { DashboardWidget } from '@/features/HomeDashboard/components/ui/DashboardWidget';
import AIAssistantWidget from '@/features/HomeDashboard/components/AIAssistantWidget';
import RequestsWidget from '@/features/HomeDashboard/components/RequestsWidget';
import NotificationsWidget from '@/features/HomeDashboard/components/NotificationsWidgets';

// ─── Greeting helper ────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function HomeDashboard() {
  const { user } = useAuthContext();

  // ── Live data hooks ────────────────────────────────────────────────────────
  const { notifications, unreadCount, markAsRead } = useNotifications(user?.uid);
  const unreadMessages = useUnreadMessageCount(user?.uid);
  const { requests, loading: requestsLoading } = useRecordRequests();

  // ── Record count (lightweight — just the count, no decryption needed) ─────
  const [recordCount, setRecordCount] = useState(0);
  const [recordsLoading, setRecordsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getAccessibleRecords(user.uid)
      .then(r => setRecordCount(r.length))
      .catch(() => setRecordCount(0))
      .finally(() => setRecordsLoading(false));
  }, [user]);

  // ── Derived booleans for GettingStarted ───────────────────────────────────
  const hasRecords = recordCount > 0;
  const hasOutboundRequests = requests.length > 0;
  // Treat profile as complete when records exist (good-enough proxy for MVP;
  // swap in a real profile-completeness check later)
  const hasProfile = hasRecords;

  // ── Stat pills — only show once user has some activity ────────────────────
  const showStats = recordCount > 0 || requests.length > 0 || unreadMessages > 0;
  const pendingRequests = requests.filter(r => r.status === 'pending').length;

  // ── Loading state — wait for records + requests before rendering ──────────
  const isLoading = recordsLoading || requestsLoading;

  // ── Display name ──────────────────────────────────────────────────────────
  const firstName = user?.displayName?.split(' ')[0] ?? '';

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      {/* Greeting */}
      <div className="mb-2">
        <h1 className="text-xl font-medium text-foreground">
          {getGreeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {unreadCount + unreadMessages + pendingRequests > 0
            ? `You have ${unreadCount + unreadMessages + pendingRequests} thing${unreadCount + unreadMessages + pendingRequests === 1 ? '' : 's'} that need your attention.`
            : 'Everything is up to date.'}
        </p>
      </div>

      {/* Getting Started — full-width, manages its own collapse */}
      <GettingStartedWidget
        hasRecords={hasRecords}
        hasOutboundRequests={hasOutboundRequests}
        hasProfile={hasProfile}
      />

      {/* Stat pills — returning users only */}
      {showStats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted rounded-lg px-3 py-2.5">
            <p className="text-lg font-medium text-foreground">{recordCount}</p>
            <p className="text-xs text-muted-foreground">Health records</p>
          </div>
          <div className="bg-muted rounded-lg px-3 py-2.5">
            <p
              className={`text-lg font-medium ${pendingRequests > 0 ? 'text-complement-4' : 'text-foreground'}`}
            >
              {pendingRequests}
            </p>
            <p className="text-xs text-muted-foreground">Open requests</p>
          </div>
          <div className="bg-muted rounded-lg px-3 py-2.5">
            <p
              className={`text-lg font-medium ${unreadMessages > 0 ? 'text-complement-1' : 'text-foreground'}`}
            >
              {unreadMessages}
            </p>
            <p className="text-xs text-muted-foreground">Unread messages</p>
          </div>
        </div>
      )}

      {/* Row 1: AI teaser + Record Requests */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AIAssistantWidget recordCount={recordCount} />

        <DashboardWidget
          title="Record requests"
          icon={FileSearch}
          badge={pendingRequests}
          actionLabel="View all"
          actionHref="/app/record-requests"
          isLoading={requestsLoading}
        >
          <RequestsWidget requests={requests} />
        </DashboardWidget>
      </div>

      {/* Row 2: Notifications + Messages — conditional */}
      {(unreadCount > 0 || unreadMessages > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DashboardWidget
            title="Notifications"
            icon={Bell}
            badge={unreadCount}
            actionLabel="View all"
            actionHref="/app/notifications"
            isVisible={unreadCount > 0}
          >
            <NotificationsWidget notifications={notifications} onMarkAsRead={markAsRead} />
          </DashboardWidget>

          <DashboardWidget
            title="Messages"
            icon={MessageSquare}
            badge={unreadMessages}
            actionLabel="View all"
            actionHref="/app/messages"
            isVisible={unreadMessages > 0}
          >
            <MessagesWidget unreadCount={unreadMessages} />
          </DashboardWidget>
        </div>
      )}
    </div>
  );
}
