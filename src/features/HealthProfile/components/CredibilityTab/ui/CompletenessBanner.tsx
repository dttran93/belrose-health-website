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
}

function getCompletenessScore(summary: BlockchainCompletenessSummary): number {
  if (summary.total === 0) return 0;
  const weighted =
    summary.anchoredMatch * 1.0 +
    summary.anchoredPreviousVersion * 0.6 +
    summary.anchoredMismatch * 0.2;
  return Math.round((weighted / summary.total) * 100);
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 50) return '#0ea5e9';
  return '#f59e0b';
}

export function CompletenessBanner({
  summary,
  privateRecordsSummary,
  totalAccessibleRecords,
  subjectName,
}: CompletenessBannerProps) {
  const score = getCompletenessScore(summary);
  const scoreColor = getScoreColor(score);
  const circ = 2 * Math.PI * 28;
  const totalRecords = totalAccessibleRecords + privateRecordsSummary.total;
  const hasFullAccess = privateRecordsSummary.total === 0;

  // Collapse not_anchored + no_hash into one "self-reported" count
  const selfReported = summary.notAnchored + summary.noHash;

  return (
    <div
      className="rounded-2xl p-5 flex items-center gap-5"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
    >
      {/* Score ring */}
      <svg width={68} height={68} viewBox="0 0 72 72" className="shrink-0">
        <circle cx={36} cy={36} r={28} fill="none" stroke="#334155" strokeWidth={6} />
        <circle
          cx={36}
          cy={36}
          r={28}
          fill="none"
          stroke={scoreColor}
          strokeWidth={6}
          strokeDasharray={circ}
          strokeDashoffset={circ - (score / 100) * circ}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text
          x={36}
          y={41}
          textAnchor="middle"
          fill="white"
          fontSize={14}
          fontWeight={700}
          fontFamily="monospace"
        >
          {score}%
        </text>
      </svg>

      {/* Text + bar */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-white mb-1">Record Completeness</p>

        {/* Access summary line */}
        {hasFullAccess ? (
          <p className="text-xs text-slate-400 mb-1">
            You have access to all {totalRecords} of {subjectName}'s reported{' '}
            {totalRecords === 1 ? 'record' : 'records'}
          </p>
        ) : (
          <p className="text-xs text-slate-400 mb-1">
            Viewing {totalAccessibleRecords} of {totalRecords}{' '}
            {totalRecords === 1 ? 'record' : 'records'}{' '}
            <span className="text-slate-500">· {privateRecordsSummary.total} private</span>
          </p>
        )}

        {/* Accessible breakdown */}
        <p className="text-xs text-slate-400">
          {!hasFullAccess && <span className="text-slate-300 font-medium">Accessible: </span>}
          {summary.anchoredMatch > 0 && (
            <span className="text-green-400">✓ {summary.anchoredMatch} current</span>
          )}
          {summary.anchoredPreviousVersion > 0 && (
            <span className="text-sky-400">
              {summary.anchoredMatch > 0 ? ' · ' : ''}
              🔵 {summary.anchoredPreviousVersion} prev. version
            </span>
          )}
          {summary.anchoredMismatch > 0 && (
            <span className="text-amber-400">
              {summary.anchoredMatch + summary.anchoredPreviousVersion > 0 ? ' · ' : ''}⚠{' '}
              {summary.anchoredMismatch} mismatch
            </span>
          )}
          {selfReported > 0 && (
            <span className="text-slate-500">
              {summary.anchoredMatch + summary.anchoredPreviousVersion + summary.anchoredMismatch >
              0
                ? ' · '
                : ''}
              ○ {selfReported} self-reported
            </span>
          )}
        </p>

        {/* Private breakdown */}
        {privateRecordsSummary.total > 0 && (
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="font-medium">Private: </span>
            {privateRecordsSummary.verified > 0 && (
              <span className="text-green-600">✓ {privateRecordsSummary.verified} verified</span>
            )}
            {privateRecordsSummary.disputed > 0 && (
              <span className="text-amber-600">
                {privateRecordsSummary.verified > 0 ? ' · ' : ''}⚠ {privateRecordsSummary.disputed}{' '}
                disputed
              </span>
            )}
            {privateRecordsSummary.selfReported > 0 && (
              <span>
                {privateRecordsSummary.verified > 0 || privateRecordsSummary.disputed > 0
                  ? ' · '
                  : ''}
                ○ {privateRecordsSummary.selfReported} self-reported
              </span>
            )}
          </p>
        )}

        {/* Stacked bar */}
        <div className="flex h-1.5 rounded-full overflow-hidden mt-2 gap-px">
          {[
            { count: summary.anchoredMatch, color: '#22c55e' },
            { count: summary.anchoredPreviousVersion, color: '#38bdf8' },
            { count: summary.anchoredMismatch, color: '#f59e0b' },
            { count: selfReported, color: '#6b7280' },
            { count: privateRecordsSummary.total, color: '#0f172a' },
          ]
            .filter(s => s.count > 0)
            .map(({ count, color }, i) => (
              <div key={i} style={{ flex: count, background: color, borderRadius: 2 }} />
            ))}
        </div>
      </div>
    </div>
  );
}

export default CompletenessBanner;
