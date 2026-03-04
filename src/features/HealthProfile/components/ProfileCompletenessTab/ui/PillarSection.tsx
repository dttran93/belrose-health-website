//src/features/HealthProfile/components/ProfileCompletenessTab/ui/PillarSection.tsx

import {
  CompletnessCriterion,
  CompletnessPillar,
  PillarStats,
} from '@/features/HealthProfile/hooks/useProfileCompleteness';
import { ArrowRight } from 'lucide-react';
import CriterionRow from './CriterionRow';
import { PILLAR_TAB_LABEL } from '@/features/HealthProfile/configs/completenessTier';

/**
 * One pillar section
 */

const PillarSection: React.FC<{
  pillar: CompletnessPillar;
  stats: PillarStats;
  criteria: CompletnessCriterion[];
  onNavigate?: () => void;
}> = ({ pillar, stats, criteria, onNavigate }) => (
  <div className="mb-6">
    {/* Pillar header */}
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold" style={{ color: stats.color }}>
          {stats.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {stats.earned} / {stats.max} pts
        </span>
      </div>
      {onNavigate && (
        <button
          onClick={onNavigate}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-card-foreground transition-colors"
        >
          {PILLAR_TAB_LABEL[pillar]}
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>

    {/* Progress bar */}
    <div
      className="h-1.5 rounded-full mb-3 overflow-hidden"
      style={{ background: stats.trackColor }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${stats.pct}%`, background: stats.color }}
      />
    </div>

    {/* Criteria rows */}
    <div className="flex flex-col gap-1.5">
      {criteria.map(c => (
        <CriterionRow key={c.id} criterion={c} color={stats.color} bgColor={stats.bgColor} />
      ))}
    </div>
  </div>
);

export default PillarSection;
