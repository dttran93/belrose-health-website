// src/features/HealthProfile/components/ProfileBlockchainTab.tsx

/**
 * ProfileBlockchainTab
 *
 * Read-only view of a subject's blockchain completeness — visible to any
 * viewer who has been granted access to the profile.
 *
 * Three layers of information per record:
 *   1. Hash history  — which on-chain hashes exist and which matches the current/previous Firestore hash
 *   2. Verifications — third-party attestations (read-only, no add/retract actions)
 *   3. Disputes      — flagged inaccuracies with severity, culpability, and reactions
 *
 * Data sources:
 *   - Chain data (anchored IDs + version history): useBlockchainCompleteness
 *   - Verifications per record: getVerificationsByRecordId (called lazily on expand)
 *   - Disputes per record:      getDisputesByRecordId (called lazily on expand)
 *   - User profiles for avatars: getUserProfiles
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react';
import { FileObject, BelroseUserProfile } from '@/types/core';
import { Button } from '@/components/ui/Button';
import { UserBadge } from '@/features/Users/components/ui/UserBadge';
import UserCard from '@/features/Users/components/ui/UserCard';
import {
  useBlockchainCompleteness,
  RecordCompletenessResult,
  RecordBlockchainStatus,
  BlockchainCompletenessSummary,
} from '../../hooks/useBlockchainCompleteness';
import {
  getVerificationsByRecordId,
  VerificationDoc,
  getVerificationConfig,
} from '@/features/Credibility/services/verificationService';
import {
  getDisputesByRecordId,
  getDisputeReactionStats,
  DisputeDocDecrypted,
  ReactionStats,
  getSeverityConfig,
  getCulpabilityConfig,
} from '@/features/Credibility/services/disputeService';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import HashRow from './ui/HashRow';
import RecordRow from './ui/RecordRow';

// ============================================================================
// TYPES
// ============================================================================

interface ProfileCredibilityTabProps {
  subjectFirebaseUid: string;
  records: FileObject[];
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

export const STATUS_CONFIG: Record<
  RecordBlockchainStatus,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    dot: string;
    icon: string;
    description: string;
  }
> = {
  anchored_match: {
    label: 'Matched',
    color: '#15803d',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    dot: '#22c55e',
    icon: '✓',
    description: 'Current record hash matches on-chain',
  },
  anchored_previous_version: {
    label: 'Traceable',
    color: '#0369a1',
    bg: '#f0f9ff',
    border: '#bae6fd',
    dot: '#0ea5e9',
    icon: '◎',
    description: 'Edited since anchoring — ancestry confirmed',
  },
  anchored_mismatch: {
    label: 'Mismatch',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    dot: '#f59e0b',
    icon: '⚠',
    description: 'On-chain but no hash version matches',
  },
  not_anchored: {
    label: 'Unanchored',
    color: '#6b7280',
    bg: '#f9fafb',
    border: '#e5e7eb',
    dot: '#9ca3af',
    icon: '○',
    description: 'No blockchain record found',
  },
  no_hash: {
    label: 'Pending',
    color: '#7c3aed',
    bg: '#faf5ff',
    border: '#e9d5ff',
    dot: '#a78bfa',
    icon: '·',
    description: 'Hash not yet available',
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function getCompletenessScore(summary: BlockchainCompletenessSummary): number {
  if (summary.total === 0) return 0;
  const weighted =
    summary.anchoredMatch * 1.0 +
    summary.anchoredPreviousVersion * 0.6 +
    summary.anchoredMismatch * 0.2;
  return Math.round((weighted / summary.total) * 100);
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Thin coloured pill matching your existing UserBadge style */
export function StatusPill({ status }: { status: RecordBlockchainStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      <span className="text-[10px]">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

/** Read-only verification entry using your existing VerificationUserCard pattern */
function VerificationEntry({
  verification,
  userProfile,
  currentRecordHash,
}: {
  verification: VerificationDoc;
  userProfile: BelroseUserProfile | undefined;
  currentRecordHash: string | null | undefined;
}) {
  const levelInfo = getVerificationConfig(verification.level);
  const isCurrent = verification.recordHash === currentRecordHash;
  const isInactive = !verification.isActive;

  return (
    <div className={isInactive ? 'opacity-60' : ''}>
      <UserCard
        user={userProfile}
        userId={verification.verifierId}
        variant="default"
        color={isInactive ? 'red' : 'green'}
        menuType="none"
        content={
          <div className="flex items-center gap-2 flex-wrap">
            <UserBadge
              text={isCurrent ? 'Current version' : 'Prior version'}
              color={isCurrent ? 'green' : 'yellow'}
              tooltip={isCurrent ? 'Verified the current hash' : 'Verified a previous hash'}
            />
            <UserBadge
              text={levelInfo.name}
              color="purple"
              tooltip={`Verification level: ${levelInfo.name}`}
            />
            {isInactive && (
              <UserBadge text="Retracted" color="red" tooltip="This verification was retracted" />
            )}
          </div>
        }
        metadata={[
          { label: 'Verified', value: verification.createdAt.toDate().toLocaleDateString() },
        ]}
      />
    </div>
  );
}

/** Read-only dispute entry using your existing DisputeUserCard pattern */
function DisputeEntry({
  dispute,
  userProfile,
  currentRecordHash,
  reactionStats,
}: {
  dispute: DisputeDocDecrypted;
  userProfile: BelroseUserProfile | undefined;
  currentRecordHash: string | null | undefined;
  reactionStats: ReactionStats | undefined;
}) {
  const severityInfo = getSeverityConfig(dispute.severity);
  const culpabilityInfo = getCulpabilityConfig(dispute.culpability);
  const isCurrent = dispute.recordHash === currentRecordHash;
  const isInactive = !dispute.isActive;

  const sevColor = dispute.severity === 3 ? 'red' : dispute.severity === 2 ? 'yellow' : 'blue';

  return (
    <div className={isInactive ? 'opacity-60' : ''}>
      <UserCard
        user={userProfile}
        userId={dispute.disputerId}
        variant="default"
        color={isInactive ? 'red' : 'yellow'}
        menuType="none"
        content={
          <div className="flex items-center gap-2 flex-wrap">
            <UserBadge
              text={isCurrent ? 'Current version' : 'Prior version'}
              color={isCurrent ? 'green' : 'yellow'}
              tooltip={isCurrent ? 'Disputed the current hash' : 'Disputed a previous hash'}
            />
            <UserBadge
              text={severityInfo.name}
              color={sevColor}
              tooltip={`Severity: ${severityInfo.name}`}
            />
            <UserBadge
              text={culpabilityInfo.name}
              color="purple"
              tooltip={`Culpability: ${culpabilityInfo.name}`}
            />
            {isInactive && (
              <UserBadge text="Retracted" color="red" tooltip="This dispute was retracted" />
            )}
            {/* Read-only reaction counts — no action surface in profile view */}
            {reactionStats && (reactionStats.supports > 0 || reactionStats.opposes > 0) && (
              <span className="text-xs text-muted-foreground ml-1">
                ↑{reactionStats.supports} ↓{reactionStats.opposes}
              </span>
            )}
          </div>
        }
        metadata={[{ label: 'Filed', value: dispute.createdAt.toDate().toLocaleDateString() }]}
      />
      {/* Notes — shown inline since there's no detail modal in this read-only context */}
      {dispute.notes && (
        <p className="mt-1 mb-2 ml-12 text-xs text-muted-foreground italic border-l-2 border-gray-200 pl-3">
          "{dispute.notes}"
        </p>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProfileCredibilityTab: React.FC<ProfileCredibilityTabProps> = ({
  subjectFirebaseUid,
  records,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    results,
    summary,
    isLoading,
    isRecomputing,
    error,
    isVerified,
    lastVerifiedAt,
    recompute,
  } = useBlockchainCompleteness(subjectFirebaseUid, records);

  const score = getCompletenessScore(summary);
  const circ = 2 * Math.PI * 28;
  const scoreColor = score >= 80 ? '#22c55e' : score >= 50 ? '#0ea5e9' : '#f59e0b';

  const handleToggle = useCallback(
    (id: string) => setExpandedId(prev => (prev === id ? null : id)),
    []
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Fetching blockchain data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-2">
        <AlertTriangle className="w-6 h-6 text-red-500 mx-auto" />
        <p className="text-sm font-medium text-red-700">Failed to load blockchain data</p>
        <p className="text-xs text-red-500">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl">
      {/* ── Completeness banner ── */}
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
          <p className="text-base font-bold text-white mb-1">Blockchain Completeness</p>
          <p className="text-xs text-slate-400">
            {summary.anchoredMatch} matched · {summary.anchoredPreviousVersion} traceable ·{' '}
            {summary.anchoredMismatch} mismatch · {summary.notAnchored} unanchored
          </p>
          {/* Stacked bar */}
          <div className="flex h-1.5 rounded-full overflow-hidden mt-2 gap-px">
            {[
              { count: summary.anchoredMatch, color: '#22c55e' },
              { count: summary.anchoredPreviousVersion, color: '#38bdf8' },
              { count: summary.anchoredMismatch, color: '#f59e0b' },
              { count: summary.notAnchored, color: '#6b7280' },
              { count: summary.noHash, color: '#a78bfa' },
            ]
              .filter(s => s.count > 0)
              .map(({ count, color }, i) => (
                <div key={i} style={{ flex: count, background: color, borderRadius: 2 }} />
              ))}
          </div>
        </div>

        {/* Verify button */}
        <div className="shrink-0 text-right space-y-1">
          <Button
            variant="outline"
            size="sm"
            onClick={recompute}
            disabled={isRecomputing}
            className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white text-xs gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${isRecomputing ? 'animate-spin' : ''}`} />
            {isRecomputing ? 'Verifying…' : isVerified ? 'Re-verify' : 'Cryptographic verify'}
          </Button>
          <p className="text-[10px] text-slate-500">
            {lastVerifiedAt
              ? `Verified ${formatRelativeTime(lastVerifiedAt)}`
              : 'Using stored hashes'}
          </p>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />
            <span className="font-medium" style={{ color: cfg.color }}>
              {cfg.label}
            </span>
            <span>— {cfg.description}</span>
          </div>
        ))}
      </div>

      {/* ── Note on separation of hash matching vs credibility ── */}
      <p className="text-xs text-muted-foreground px-1 border-l-2 border-border pl-3">
        Hash matching confirms the record's data integrity on-chain. Verifications and disputes are
        independent third-party assessments of a specific hash version's clinical accuracy.
      </p>

      {/* ── Record list ── */}
      <div className="space-y-2">
        {results.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No records to display.
          </div>
        )}
        {results.map(result => {
          const id = result.record.id || result.record.firestoreId || '';
          return (
            <RecordRow
              key={id}
              result={result}
              expanded={expandedId === id}
              onToggle={() => handleToggle(id)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ProfileCredibilityTab;
