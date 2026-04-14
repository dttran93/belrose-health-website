// src/features/RefineRecord/components/RecordActionGroup.tsx

/**
 * RecordActionGroup
 *
 * Renders outstanding follow-up items for a single record.
 * Exists as a separate component so useRecordFollowUps can be called
 * as a hook (hooks can't be called inside a .map() in the parent).
 *
 * Renders nothing if the record has no outstanding actions.
 */

import React from 'react';
import { FileObject } from '@/types/core';
import { useNavigate } from 'react-router-dom';
import FollowUpItems from './FollowUpItems';
import useRecordFollowUps from '../../hooks/useRecordFollowUps';

interface RecordActionGroupProps {
  record: FileObject;
}

export const RecordActionGroup: React.FC<RecordActionGroupProps> = ({ record }) => {
  const navigate = useNavigate();

  const { followUpItems, isLoading } = useRecordFollowUps(record, {
    onAction: (_, itemId) => {
      // Navigate to the record with the relevant view pre-selected
      const viewMap: Record<string, string> = {
        subject: 'subject',
        'subject-rejection': 'subject',
        verify: 'credibility',
        'link-request': 'follow-ups',
      };
      const view = viewMap[itemId] ?? 'follow-ups';
      navigate(`/app/records/${record.id}?view=${view}`);
    },
  });

  // Skeleton while loading — holds space so the list doesn't jump
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-100 bg-white p-4 animate-pulse">
        <div className="h-4 w-1/3 bg-gray-200 rounded mb-3" />
        <div className="h-10 bg-gray-100 rounded" />
      </div>
    );
  }

  // Nothing to show for this record
  if (followUpItems.length === 0) return null;

  const recordTitle =
    record.belroseFields?.title || record.fileName || `Record ${record.id.slice(0, 8)}`;

  return (
    <div className="rounded-lg border border-border/20 bg-background overflow-hidden">
      {/* Record header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-border/20 cursor-pointer hover:bg-amber-100 transition-colors"
        onClick={() => navigate(`/app/records/${record.id}`)}
      >
        <div className="min-w-0 text-left text-foreground">
          <p className="text-sm font-medium truncate">{recordTitle}</p>
          {record.belroseFields?.completedDate && (
            <p className="text-xs mt-0.5">{record.belroseFields.completedDate}</p>
          )}
        </div>
        <span className="ml-3 flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
          {followUpItems.length} {followUpItems.length === 1 ? 'action' : 'actions'}
        </span>
      </div>

      {/* Follow-up items — no onDismiss here, dismissal is per-session in FileListItem */}
      <div className="p-3">
        <FollowUpItems items={followUpItems} />
      </div>
    </div>
  );
};

export default RecordActionGroup;
