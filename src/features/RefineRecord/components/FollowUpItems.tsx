// src/features/RefineRecord/components/FollowUpItems.tsx

/**
 * This component shows follow-up items related to record refinement, such as:
 * Adding a subject
 * Adding a verification/dispute
 *
 */

// src/components/ui/FollowUpItems/FollowUpItems.tsx

import React from 'react';
import { AlertCircle, Check } from 'lucide-react';

export type FollowUpStatus = 'pending' | 'done' | 'skipped';

export interface FollowUpItem {
  /** Unique key for this item */
  id: string;
  /** Main label shown to the user */
  label: string;
  /** Secondary hint text */
  subtext?: string;
  /** Lucide icon component (or any ReactNode) */
  icon: React.ComponentType<{ className?: string }>;
  status: FollowUpStatus;
  /** Text on the action button */
  ctaLabel: string;
  /** Called when the user clicks the action button */
  onAction: () => void;
  /**
   * Optional: text shown when status === 'done' instead of subtext.
   * e.g. "Jane Doe · request sent"
   */
  doneSubtext?: string;
}

export interface FollowUpItemsProps {
  items: FollowUpItem[];
  /** Called when the user clicks "dismiss" — hide the whole section */
  onDismiss?: () => void;
}

// ─── Single row ──────────────────────────────────────────────────────────────

const FollowUpRow: React.FC<{ item: FollowUpItem }> = ({ item }) => {
  const isDone = item.status === 'done';
  const IconComponent = item.icon;

  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg border
        bg-white transition-opacity
        ${isDone ? 'border-gray-200 opacity-60' : 'border-amber-300'}
      `}
    >
      {/* Icon */}
      <div
        className={`
          w-7 h-7 rounded-full flex items-center justify-center shrink-0
          ${isDone ? 'bg-green-50' : 'bg-amber-50'}
        `}
      >
        <span className={`w-4 h-4 ${isDone ? 'text-green-600' : 'text-amber-600'}`}>
          <IconComponent className="w-full h-full" />
        </span>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm text-left font-medium leading-tight ${
            isDone ? 'line-through text-gray-400' : 'text-gray-800'
          }`}
        >
          {item.label}
        </p>
        {(isDone ? item.doneSubtext : item.subtext) && (
          <p className="text-xs text-left text-gray-500 mt-0.5">
            {isDone ? item.doneSubtext : item.subtext}
          </p>
        )}
      </div>

      {/* CTA or done check */}
      {isDone ? (
        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <Check className="w-3 h-3 text-green-700" />
        </div>
      ) : (
        <button
          onClick={item.onAction}
          className="
            shrink-0 text-xs font-medium px-3 py-1.5 rounded-md
            bg-amber-600 text-amber-50
            hover:bg-amber-700 transition-colors
          "
        >
          {item.ctaLabel}
        </button>
      )}
    </div>
  );
};

// ─── Container ───────────────────────────────────────────────────────────────

export const FollowUpItems: React.FC<FollowUpItemsProps> = ({ items, onDismiss }) => {
  const pendingCount = items.filter(i => i.status === 'pending').length;

  // Don't render if everything is done and there's nothing to show
  if (items.length === 0) return null;

  const headerText =
    pendingCount === items.length
      ? 'File Uploaded! There are a few follow-up steps to complete this record'
      : `${pendingCount} of ${items.length} steps remaining`;

  return (
    <div className="bg-amber-50 border-t border-amber-200 px-4 py-3 rounded-xl">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="text-xs font-medium text-amber-800 flex-1">{headerText}</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex flex-col gap-1.5">
        {items.map(item => (
          <FollowUpRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};

export default FollowUpItems;
