// src/features/RefineRecord/components/FollowUpBadge.tsx

/**
 * FollowUpBadge
 *
 * A small amber badge that shows how many follow-up actions are outstanding
 * on a record.
 *
 * Renders nothing when there are no outstanding items or while loading.
 *
 * Usage:
 *   <FollowUpBadge record={record} onClick={() => setViewMode('follow-ups')} />
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { FileObject } from '@/types/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import useRecordFollowUps from '../hooks/useRecordFollowUps';

interface FollowUpBadgeProps {
  record: FileObject;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
  lg: 'px-3 py-1.5 text-sm gap-2',
};

const iconSizes = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
  lg: 'w-4 h-4',
};

export const FollowUpBadge: React.FC<FollowUpBadgeProps> = ({ record, onClick, size = 'sm' }) => {
  const { followUpItems, isLoading } = useRecordFollowUps(record, {
    onAction: () => onClick(),
  });

  // Render loading or when there's nothing when there's no action
  if (isLoading) {
    return (
      <div
        className={`
      inline-flex items-center rounded-full border
      bg-gray-100 border-gray-200 animate-pulse
      ${sizeClasses[size]}
    `}
      >
        {' '}
        Loading...
      </div>
    );
  }

  if (followUpItems.length === 0) return null;

  const label =
    followUpItems.length === 1 ? '1 action needed' : `${followUpItems.length} actions needed`;

  const tooltipText = followUpItems.map(i => `• ${i.label}`).join('\n');

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            onClick={onClick}
            className={`
              inline-flex items-center rounded-full border font-medium
              bg-amber-50 text-amber-700 border-amber-200
              hover:bg-amber-100 hover:border-amber-300
              transition-colors cursor-pointer
              ${sizeClasses[size]}
            `}
          >
            <AlertTriangle className={iconSizes[size]} />
            <span>{label}</span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs z-50 whitespace-pre-line"
            sideOffset={5}
          >
            {tooltipText}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default FollowUpBadge;
