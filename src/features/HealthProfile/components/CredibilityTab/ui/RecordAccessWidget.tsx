// src/features/HealthProfile/components/ui/RecordAccessWidget.tsx

/**
 * RecordAccessWidget
 *
 * Shows how many of a subject's on-chain anchored records are visible
 * to the current viewer. Purely an access transparency signal —
 * no hash integrity logic here (that lives in the Credibility tab).
 *
 * Logic:
 *   - Total = all record IDs anchored on-chain by this subject
 *   - Visible = those that also appear in the viewer's accessible records
 *   - pct = visible / total
 *
 * If a record is on-chain but not visible to the viewer, the subject
 * hasn't shared it with them. This is expected and fine — it's not a bug,
 * just a permission boundary.
 *
 * Shown to all viewers (including owner). Hidden while blockchain data loads.
 */

import React from 'react';
import { ArrowUpRight } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface RecordAccessWidgetProps {
  /** All record IDs anchored on-chain for this subject */
  anchoredCount: number;
  /** How many of those anchored records the viewer can access */
  visibleCount: number;
  /** True while blockchain data is still loading */
  isLoading?: boolean;
  /** Called when user clicks to go to Credibility tab */
  onViewDetails: () => void;
}

export const RecordAccessWidget: React.FC<RecordAccessWidgetProps> = ({
  anchoredCount,
  visibleCount,
  isLoading = false,
  onViewDetails,
}) => {
  const pct = anchoredCount > 0 ? Math.round((visibleCount / anchoredCount) * 100) : 0;

  const color =
    pct === 100
      ? '#10b77f' // complement-3 Emerald — full access
      : pct >= 50
        ? '#088eaf' // complement-2 Cyan — partial
        : '#f59f0a'; // complement-4 Golden — limited

  return (
    <button
      onClick={onViewDetails}
      className="w-full text-left rounded-xl border border-border bg-primary px-3 py-2.5
        hover:border-muted-foreground hover:shadow-md transition-all duration-150 group"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-white">
          Record Access
        </span>
        <ArrowUpRight className="w-3 h-3 text-muted-foreground group-hover:text-white transition-colors" />
      </div>

      {isLoading ? (
        <div className="h-8 w-full bg-muted rounded animate-pulse" />
      ) : anchoredCount === 0 ? (
        <p className="text-xs text-white">No records anchored yet</p>
      ) : (
        <>
          {/* Count + label */}
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-xl font-black leading-none" style={{ color }}>
              {visibleCount}/{anchoredCount}
            </span>
            <span className="text-[10px] font-medium" style={{ color, opacity: 0.75 }}>
              {pct === 100 ? 'Full access' : 'records visible'}
            </span>
          </div>

          {/* Bar */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: color + '28' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
        </>
      )}
    </button>
  );
};

export default RecordAccessWidget;
