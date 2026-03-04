//src/features/HealthProfile/components/ProfileCompletenessTab

import { PILLAR_TAB_MAP, TIER_CONFIG } from '../../configs/completenessTier';
import { CompletnessPillar, ProfileCompletenessResult } from '../../hooks/useProfileCompleteness';
import PillarSection from './ui/PillarSection';

interface ProfileCompletenessTabProps {
  completeness: ProfileCompletenessResult;
  /** Called when user clicks a tab-navigation CTA (e.g. "Go to Identity") */
  onNavigateToTab?: (tab: string) => void;
}

export const ProfileCompletenessTab: React.FC<ProfileCompletenessTabProps> = ({
  completeness,
  onNavigateToTab,
}) => {
  const { criteria, pillars, score, maxScore, pct, tier, tierColor, nextStep, incompleteCount } =
    completeness;

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Score banner ─────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-5 mb-6 flex items-center gap-5"
        style={{
          background: tierColor + '0d',
          borderColor: tierColor + '30',
        }}
      >
        {/* Big percentage */}
        <div className="text-center flex-shrink-0 w-16">
          <div className="text-4xl font-black leading-none" style={{ color: tierColor }}>
            {pct}%
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {score} / {maxScore} pts
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-card-foreground mb-2">{tier}</div>

          {/* Tier ladder */}
          <div className="flex gap-1 mb-2">
            {TIER_CONFIG.map(step => (
              <div
                key={step.label}
                className="flex-1 h-1 rounded-full transition-all duration-500"
                style={{ background: score >= step.min ? tierColor : 'hsl(var(--muted))' }}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {incompleteCount === 0
              ? '🎉 Your profile is fully complete!'
              : `${incompleteCount} step${incompleteCount !== 1 ? 's' : ''} remaining to level up`}
          </p>
        </div>
      </div>

      {/* ── Pillar sections ───────────────────────────────────────────────── */}
      {(['identity', 'clinical', 'records'] as CompletnessPillar[]).map(pillar => (
        <PillarSection
          key={pillar}
          pillar={pillar}
          stats={pillars[pillar]}
          criteria={criteria.filter(c => c.pillar === pillar)}
          onNavigate={onNavigateToTab ? () => onNavigateToTab(PILLAR_TAB_MAP[pillar]) : undefined}
        />
      ))}

      {/* ── Next step nudge ───────────────────────────────────────────────── */}
      {nextStep && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <span className="text-base flex-shrink-0 mt-0.5">✨</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">Next step</p>
            <p className="text-sm text-amber-800 mt-0.5">
              {nextStep.label}
              {nextStep.hint && <span className="text-amber-700"> — {nextStep.hint}</span>}
            </p>
          </div>
          <span className="text-sm font-bold text-amber-600 flex-shrink-0 ml-auto">
            +{nextStep.points} pts
          </span>
        </div>
      )}
    </div>
  );
};

export default ProfileCompletenessTab;
