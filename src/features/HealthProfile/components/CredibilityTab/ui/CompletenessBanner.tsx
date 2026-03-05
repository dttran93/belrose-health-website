// src/features/HealthProfile/components/CredibilityTab/ui/CompletenessBanner.tsx

/**
 * CompletenessBanner at the top of the Credibility section of the Health Profile
 */

import {
  BlockchainCompletenessSummary,
  PrivateRecordsSummary,
} from '../../../hooks/useBlockchainCompleteness';

interface CompletenessBannerProps {
  summary: BlockchainCompletenessSummary;
  privateRecordsSummary: PrivateRecordsSummary;
  totalAccessibleRecords: number;
  subjectName: string;
  anchoredCount: number;
  visibleCount: number;
}

// Access ring color — mirrors RecordAccessWidget logic
function getAccessColor(pct: number): string {
  if (pct === 100) return '#10b77f';
  if (pct >= 50) return '#088eaf';
  return '#f59f0a';
}

export function CompletenessBanner({
  summary,
  privateRecordsSummary,
  totalAccessibleRecords,
  subjectName,
  anchoredCount,
  visibleCount,
}: CompletenessBannerProps) {
  const circ = 2 * Math.PI * 28;

  // Ring: record access (matches RecordAccessWidget)
  const accessPct = anchoredCount > 0 ? Math.round((visibleCount / anchoredCount) * 100) : 0;
  const ringColor = getAccessColor(accessPct);

  // Bar: 4 credibility categories
  const selfReported = summary.selfReported;
  const flagged = summary.flagged; // disputed + mismatch — keep simple for now

  const totalRecords = totalAccessibleRecords + privateRecordsSummary.total;
  const hasFullAccess = privateRecordsSummary.total === 0;

  const barSegments = [
    { count: summary.currentVerified, color: '#22c55e', label: 'current verified' },
    { count: summary.traceable, color: '#38bdf8', label: 'prev. version verified' },
    { count: flagged, color: '#f59e0b', label: 'flagged' },
    { count: selfReported, color: '#475569', label: 'self-reported' },
  ].filter(s => s.count > 0);

  return (
    <div
      className="rounded-2xl p-5 flex items-center gap-5"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
    >
      {/* ── Access ring (mirrors RecordAccessWidget) ── */}
      <div className="shrink-0 flex flex-col items-center gap-1">
        <svg width={68} height={68} viewBox="0 0 72 72">
          <circle cx={36} cy={36} r={28} fill="none" stroke="#334155" strokeWidth={6} />
          {anchoredCount > 0 && (
            <circle
              cx={36}
              cy={36}
              r={28}
              fill="none"
              stroke={ringColor}
              strokeWidth={6}
              strokeDasharray={circ}
              strokeDashoffset={circ - (accessPct / 100) * circ}
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          )}
          <text
            x={36}
            y={36}
            textAnchor="middle"
            fill="white"
            fontSize={11}
            fontWeight={700}
            fontFamily="monospace"
            dy="0.1em"
          >
            {anchoredCount > 0 ? `${visibleCount}/${anchoredCount}` : '—'}
          </text>
          <text
            x={36}
            y={47}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={7}
            fontFamily="sans-serif"
          >
            {anchoredCount > 0 ? (accessPct === 100 ? 'full access' : 'accessible') : 'no records'}
          </text>
        </svg>
      </div>

      {/* ── Right side: title, breakdown text, bar ── */}
      <div className="flex-1 min-w-0 flex flex-col items-center text-center">
        <p className="text-base font-bold text-white mb-1">Record Credibility</p>

        {/* Access line */}
        {hasFullAccess ? (
          <p className="text-xs text-slate-400 mb-1">
            All {totalRecords} of {subjectName}'s {totalRecords === 1 ? 'record' : 'records'} are
            accessible
          </p>
        ) : (
          <p className="text-xs text-slate-400 mb-1">
            {totalAccessibleRecords} of {totalRecords} {totalRecords === 1 ? 'record' : 'records'}{' '}
            visible
            <span className="text-slate-500"> · {privateRecordsSummary.total} private</span>
          </p>
        )}

        {/* Credibility breakdown */}
        <p className="text-xs text-slate-400 flex flex-wrap gap-x-2">
          {summary.currentVerified > 0 && (
            <span className="text-green-400">✓ {summary.currentVerified} current</span>
          )}
          {summary.traceable > 0 && (
            <span className="text-sky-400">🔵 {summary.traceable} traceable</span>
          )}
          {flagged > 0 && <span className="text-amber-400">⚠ {flagged} flagged</span>}
          {selfReported > 0 && (
            <span className="text-slate-500">○ {selfReported} self-reported</span>
          )}
        </p>

        {/* Stacked bar */}
        <div className="flex h-1.5 w-full rounded-full overflow-hidden mt-2 gap-px">
          {barSegments.map(({ count, color }, i) => (
            <div key={i} style={{ flex: count, background: color, borderRadius: 2 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default CompletenessBanner;
