// src/features/HealthProfile/components/ui/ProfileCompletenessWidget.tsx

/**
 * ProfileCompletenessWidget
 *
 * Compact right-side panel in ProfileHeader showing:
 *  - "Profile Completeness" label
 *  - Score % + tier name
 *  - Three stacked pillar bars (Identity / Clinical / Records)
 *
 * Clicking the widget calls onViewDetails, which navigates to the
 * Completeness tab for the full breakdown.
 *
 * Only shown on own profile — no point showing completeness to visitors.
 */

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { ProfileCompletenessResult } from '../../hooks/useProfileCompleteness';

// ============================================================================
// TYPES
// ============================================================================

interface ProfileCompletenessWidgetProps {
  completeness: ProfileCompletenessResult;
  onViewDetails: () => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProfileCompletenessWidget: React.FC<ProfileCompletenessWidgetProps> = ({
  completeness,
  onViewDetails,
}) => {
  const { pillars, pct, tier, tierColor } = completeness;

  return (
    <button
      onClick={onViewDetails}
      className="w-full text-left rounded-xl border border-border bg-secondary px-3 py-2.5
        hover:border-muted-foreground hover:shadow-md transition-all duration-150 group"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          Profile Completeness
        </span>
        <ArrowUpRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
      </div>

      {/* Score + tier */}
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-xl font-black leading-none" style={{ color: tierColor }}>
          {pct}%
        </span>
        <span className="text-[10px] font-medium" style={{ color: tierColor, opacity: 0.75 }}>
          {tier}
        </span>
      </div>

      {/* Segmented bar — each pillar gets 1/3 width, coloured by its own color */}
      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
        {Object.values(pillars).map(p => (
          <div
            key={p.label}
            className="flex-1 rounded-full overflow-hidden"
            style={{ background: p.trackColor }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${p.pct}%`, background: p.color }}
            />
          </div>
        ))}
      </div>
    </button>
  );
};

export default ProfileCompletenessWidget;
