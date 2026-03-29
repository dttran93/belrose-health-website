// src/components/ui/RecordSectionPanel.tsx

/**
 * Section Panel for use with RecordFull - provides consistent styling for each section (e.g. Subjects, Versions, etc)
 */

import React from 'react';
import { HelpCircle, Plus } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

export type SectionPanelVariant = 'default' | 'accent';

interface Badge {
  label: string;
  className: string;
}

interface RecordSectionPanelProps {
  // Header — left side
  icon: React.ReactNode;
  title: string;
  badges?: Badge[];

  variant?: SectionPanelVariant;

  showActions?: boolean;
  tooltipLabel?: string;
  tooltipContent?: React.ReactNode;
  tooltipClassName?: string;
  onAdd?: () => void;
  headerAction?: React.ReactNode;

  isLoading?: boolean;
  loadingLabel?: string;
  isEmpty?: boolean;
  emptyState?: React.ReactNode;
  children?: React.ReactNode;

  errorState?: React.ReactNode;

  className?: string;
}

// All the visual differences between variants live here — one place to update.
const variantStyles: Record<
  SectionPanelVariant,
  { border: string; headerBg: string; bodyBg: string }
> = {
  default: {
    border: 'border-gray-200',
    headerBg: 'bg-gray-50',
    bodyBg: 'bg-white',
  },
  accent: {
    border: 'border-accent',
    headerBg: 'bg-accent',
    bodyBg: 'bg-secondary',
  },
};

export const RecordSectionPanel: React.FC<RecordSectionPanelProps> = ({
  icon,
  title,
  badges = [],
  variant = 'default',
  showActions = true,
  tooltipLabel,
  tooltipContent,
  tooltipClassName = 'border border-gray-300 bg-gray-100 text-gray-700',
  onAdd,
  headerAction,
  isLoading = false,
  loadingLabel = 'Loading...',
  isEmpty = false,
  emptyState,
  children,
  className = '',
  errorState,
}) => {
  const styles = variantStyles[variant];

  return (
    <div className={`mb-4 border ${styles.border} rounded-lg ${className}`}>
      {/* ── Header ── */}
      <div
        className={`w-full px-3 py-3 ${styles.headerBg} flex items-center justify-between rounded-t-lg gap-2`}
      >
        {/* Left: icon + title + badges */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="flex-shrink-0">{icon}</span>
          <span className="font-semibold text-gray-900 truncate">{title}</span>
          {/* Badges wrap on mobile so they don't push the actions off screen */}
          <div className="flex items-center gap-1 flex-wrap">
            {badges.map((badge, i) => (
              <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>
                {badge.label}
              </span>
            ))}
          </div>
        </div>

        {/* Right: tooltip + add button */}
        {showActions && (tooltipContent || onAdd) && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {tooltipContent && tooltipLabel && (
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${tooltipClassName}`}
                    >
                      {/* Hide label on very small screens, keep icon */}
                      <span className="hidden sm:inline">{tooltipLabel}</span>
                      <HelpCircle className="w-4 h-4 flex-shrink-0" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
                      sideOffset={5}
                    >
                      {tooltipContent}
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            )}
            {headerAction ??
              (onAdd && (
                <button
                  onClick={onAdd}
                  className="p-1 rounded-full hover:bg-black/10 transition-colors"
                  aria-label={`Add to ${title}`}
                >
                  <Plus className="w-5 h-5" />
                </button>
              ))}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className={`p-4 ${styles.bodyBg} rounded-b-lg`}>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <p className="text-gray-500">{loadingLabel}</p>
          </div>
        ) : errorState ? (
          errorState
        ) : isEmpty ? (
          emptyState
        ) : (
          <div className="space-y-3">{children}</div>
        )}
      </div>
    </div>
  );
};

export default RecordSectionPanel;
