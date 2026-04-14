// src/features/RefineRecord/components/FollowUpActionsManager.tsx

/**
 * Aggregates outstanding follow-up actions across all of the current
 * user's records. Used as the "Actions" tab inside ActivityHub.
 *
 * Architecture note: useRecordFollowUps can't be called inside a .map(),
 * so each record gets its own <RecordActionGroup> child component which
 * owns the hook call. This component just handles fetching all records
 * and rendering the list.
 */

import React from 'react';
import { Loader2, ListChecks } from 'lucide-react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { useUserRecords } from '@/features/ViewEditRecord/hooks/useUserRecords';
import RecordActionGroup from './ui/RecordActionGroup';

export const FollowUpActionsManager: React.FC = () => {
  const { user } = useAuthContext();
  const { records, loading, error } = useUserRecords(user?.uid, { filterType: 'all' });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Loading your records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-sm text-red-600">Failed to load records. Please try again.</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <ListChecks className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No records yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Once you add health records, any outstanding actions will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <p className="text-sm text-muted-foreground mb-2">
        Outstanding actions across your records. Click a record header to open it.
      </p>

      {/*
        Each RecordActionGroup calls useRecordFollowUps internally.
        Groups that have no outstanding actions render nothing,
        so only records with pending items are visible.
      */}
      {records.map(record => (
        <RecordActionGroup key={record.id} record={record} />
      ))}

      {/*
        All-done state — shown after all groups have resolved with no items.
        We use a CSS trick: if every child renders null, this empty-state
        div is the only visible element. We can't know the aggregate count
        here without lifting state, so we rely on the grid being visually
        empty instead.
      */}
      <div className="hidden only:flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
          <ListChecks className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">All caught up!</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          No outstanding actions across any of your records.
        </p>
      </div>
    </div>
  );
};

export default FollowUpActionsManager;
