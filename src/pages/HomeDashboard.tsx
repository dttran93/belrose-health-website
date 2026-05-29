// src/pages/HomeDashboard.tsx

/**
 * HomeDashboard  —  /app
 *
 * The main landing page after login. Replaces AppPortal as the /app route.
 * AppPortal moves to /app/ai (renamed AIPortal.tsx).
 *
 * Data strategy:
 *   - useHealthProfile(user.uid) loads + groups all the user's records.
 *   - useProfileCompleteness() consumes that data to drive GettingStartedWidget.
 *     Identical call to HealthProfile.tsx so the % always stays in sync.
 *   - useNotifications, useUnreadMessageCount, useRecordRequests provide
 *     the live activity widgets.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Bell, FileSearch, ListChecks, MessageSquare } from 'lucide-react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import useNotifications from '@/features/Notifications/hooks/useNotifications';
import { useUnreadMessageCount } from '@/features/Messaging/hooks/useUnreadMessageCount';
import { useRecordRequests } from '@/features/RequestRecord/hooks/useRecordRequests';
import { GettingStartedWidget } from '@/features/HomeDashboard/components/GettingStartedWidget';
import { MessagesWidget } from '@/features/HomeDashboard/components/MessagesWidget';
import { DashboardWidget } from '@/features/HomeDashboard/components/ui/DashboardWidget';
import AIAssistantWidget from '@/features/HomeDashboard/components/AIAssistantWidget';
import RequestsWidget from '@/features/HomeDashboard/components/RequestsWidget';
import NotificationsWidget from '@/features/HomeDashboard/components/NotificationsWidgets';
import { useProfileCompleteness } from '@/features/HealthProfile/hooks/useProfileCompleteness';
import { parseIdentityFromRecord } from '@/features/HealthProfile/utils/parseUserIdentity';
import { getIdentityRecordId } from '@/features/HealthProfile/services/userIdentityService';
import { useUserRecords } from '@/features/ViewEditRecord/hooks/useUserRecords';
import { BelroseUserProfile } from '@/types/core';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import useHealthProfile from '@/features/HealthProfile/hooks/useHealthProfile';
import { useActionsCount } from '@/features/RefineRecord/hooks/useActionsCount';
import FollowUpsWidget from '@/features/HomeDashboard/components/FollowUpsWidget';

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

  // ── Health profile data — drives completeness + record count ──────────────
  // Calling with user.uid means filterType: 'subject' + subjectId === userId,
  // which is the cheapest Firestore query (single array-contains index).
  const {
    records,
    grouped,
    recordCount,
    isLoading: profileLoading,
  } = useHealthProfile(user?.uid ?? '');

  // ── Belrose account profile (identity verification, avatar) ───────────────
  const [profile, setProfile] = useState<BelroseUserProfile | null>(null);
  useEffect(() => {
    if (!user?.uid) return;
    getUserProfile(user.uid).then(setProfile);
  }, [user?.uid]);

  // ── Identity record — same pattern as HealthProfile.tsx ───────────────────
  // useUserRecords gives us all subject records; we find the identity record
  // by its deterministic ID rather than making a separate Firestore query.
  const { records: allSubjectRecords } = useUserRecords(user?.uid, {
    filterType: 'subject',
    subjectId: user?.uid,
  });

  const identityRecord = useMemo(
    () =>
      user?.uid
        ? (allSubjectRecords.find(r => r.id === getIdentityRecordId(user.uid)) ?? null)
        : null,
    [allSubjectRecords, user?.uid]
  );

  const userIdentity = useMemo(
    () => (identityRecord ? parseIdentityFromRecord(identityRecord) : null),
    [identityRecord]
  );

  // ── Profile completeness — identical call to HealthProfile.tsx ────────────
  // This ensures the % shown here always matches the Health Profile page.
  const completeness = useProfileCompleteness({ profile, userIdentity, grouped, records });

  // ── Live activity hooks ───────────────────────────────────────────────────
  const { notifications, unreadCount, markAsRead } = useNotifications(user?.uid);
  const unreadMessages = useUnreadMessageCount(user?.uid);
  const { requests, loading: requestsLoading } = useRecordRequests();

  // ── Actions hooks ─────────────────────────────────────────────────────────

  const { count: actionsCount } = useActionsCount();
  const { records: allRecords, loading: recordsLoading } = useUserRecords(user?.uid, {
    filterType: 'all',
  });

  // ── Derived values ────────────────────────────────────────────────────────
  const pendingRequests = requests.filter(r => r.status === 'pending').length;
  const hasOutboundRequests = requests.length > 0;
  const showStats = recordCount > 0 || requests.length > 0 || unreadMessages > 0;
  const attentionCount = unreadCount + unreadMessages + pendingRequests + actionsCount;

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
          {attentionCount > 0
            ? `You have ${attentionCount} thing${attentionCount === 1 ? '' : 's'} that need your attention.`
            : 'Everything is up to date.'}
        </p>
      </div>

      {/* Getting Started — full-width, manages its own collapsed/expanded state.
          Receives the full completeness result so steps reflect real data. */}
      <GettingStartedWidget
        completeness={completeness}
        hasOutboundRequests={hasOutboundRequests}
        isGuest={user.isGuest ?? false}
        isLoading={profileLoading}
      />

      {actionsCount > 0 && (
        <DashboardWidget
          title="Actions"
          icon={ListChecks}
          badge={actionsCount}
          actionLabel="View all"
          actionHref="/app/activity?tab=actions"
          isVisible={actionsCount > 0 || !recordsLoading}
          isLoading={recordsLoading}
        >
          <FollowUpsWidget records={allRecords} />
        </DashboardWidget>
      )}

      {/* Stat pills — only shown once the user has some activity */}
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

      {/* Row 2: Notifications + Messages — only shown when there's something to see */}
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
