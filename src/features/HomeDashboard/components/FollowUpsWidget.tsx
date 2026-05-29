// src/features/HomeDashboard/components/FollowUpsWidget.tsx

/**
 * FollowUpsWidget
 *
 * Dashboard preview of outstanding record actions.
 * Shows up to MAX_RECORDS records that have pending items.
 *
 * Reuses RecordActionGroup children to call useRecordFollowUps legally
 * (one hook per component instance). Each group renders null if it has
 * no items, so only records with real actions are visible.
 *
 * The "only:flex" CSS trick from FollowUpActionsManager is used here too:
 * if every RecordActionGroup renders null, the all-clear message is the
 * only child and becomes visible.
 */

import React from 'react';
import { FileObject } from '@/types/core';
import { useNavigate } from 'react-router-dom';
import useRecordFollowUps from '@/features/RefineRecord/hooks/useRecordFollowUps';
import { LucideIcon } from 'lucide-react';
import { FollowUpItemId } from '@/features/RefineRecord/components/ui/FollowUpItems';

const MAX_RECORDS = 3;

// ─── Per-record row ───────────────────────────────────────────────────────────
// Mirrors RecordActionGroup but in a compact single-line format for the widget.
// Calling useRecordFollowUps here (not in the parent map) satisfies Rules of Hooks.

interface FollowUpRowProps {
  record: FileObject;
}

const FollowUpRow: React.FC<FollowUpRowProps> = ({ record }) => {
  const navigate = useNavigate();

  const viewMap: Record<FollowUpItemId, string> = {
    subject: 'subject',
    'subject-request': 'subject',
    'subject-rejection': 'subject',
    verify: 'credibility',
    'link-request': 'record',
  };

  const { followUpItems, isLoading } = useRecordFollowUps(record, {
    onAction: (_, itemId) => {
      navigate(`/app/records/${record.id}?view=${viewMap[itemId]}`);
    },
  });

  if (isLoading || followUpItems.length === 0) return null;

  const firstItem = followUpItems[0];
  if (!firstItem) return null;
  const Icon = firstItem.icon as LucideIcon;
  const recordTitle = record.belroseFields?.title || record.fileName || 'Untitled record';
  const extraCount = followUpItems.length - 1;

  return (
    <button
      onClick={() => navigate(`/app/records/${record.id}?view=${viewMap[firstItem.id]}`)}
      className="flex items-start gap-3 py-2.5 text-left hover:bg-muted/50 -mx-1 px-1 rounded transition-colors w-full"
    >
      {/* Icon from the first item */}
      <div className="h-5 flex items-center flex-shrink-0 text-complement-4">
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        {/* First action label */}
        <p className="text-sm font-medium text-foreground truncate">{firstItem.label}</p>
        {/* Record title as context */}
        <p className="text-xs text-muted-foreground truncate">{recordTitle}</p>
      </div>

      {/* Show "+N more" if multiple actions on this record */}
      {extraCount > 0 ? (
        <span className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          +{extraCount} more
        </span>
      ) : (
        <span className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
          {firstItem.ctaLabel}
        </span>
      )}
    </button>
  );
};

// ─── Widget ───────────────────────────────────────────────────────────────────

interface FollowUpsWidgetProps {
  records: FileObject[];
}

export const FollowUpsWidget: React.FC<FollowUpsWidgetProps> = ({ records }) => {
  const capped = records.slice(0, MAX_RECORDS);

  return (
    <div className="flex flex-col divide-y divide-border">
      {capped.map(record => (
        <FollowUpRow key={record.id} record={record} />
      ))}

      {/* All-done state — only visible when every FollowUpRow renders null */}
      <p className="hidden only:block text-sm text-muted-foreground py-2 text-center">
        All caught up!
      </p>
    </div>
  );
};

export default FollowUpsWidget;
