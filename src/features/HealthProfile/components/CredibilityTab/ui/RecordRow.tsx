// ============================================================================
// RECORD ROW
// ============================================================================

import {
  DisputeDocDecrypted,
  getDisputeReactionsByType,
  getDisputeReactionStats,
  getDisputesByRecordId,
  ReactionStats,
} from '@/features/Credibility/services/disputeService';
import {
  getVerificationsByRecordId,
  VerificationDoc,
} from '@/features/Credibility/services/verificationService';
import {
  RecordBlockchainStatus,
  RecordCompletenessResult,
} from '@/features/HealthProfile/hooks/useBlockchainCompleteness';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { AlertTriangle, ChevronDown, Shield } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import HashRow from './HashRow';
import { STATUS_CONFIG } from '../ProfileCredibilityTab';
import { BelroseUserProfile } from '@/types/core';
import VerificationUserCard from '@/features/Credibility/components/Verifications/VerificationUserCard';
import VerificationDetailModal from '@/features/Credibility/components/Verifications/VerificationDetailModal';
import useAuth from '@/features/Auth/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import DisputeUserCard from '@/features/Credibility/components/Disputes/DisputeUserCard';
import DisputeDetailModal from '@/features/Credibility/components/Disputes/DisputeDetailModal';
import { getReactionType } from '@/features/Credibility/components/Disputes/DisputeManagement';

type SectionTab = 'hashes' | 'verifications' | 'disputes';
interface RecordCredibilityData {
  verifications: VerificationDoc[];
  disputes: DisputeDocDecrypted[];
  reactionStatsMap: Map<string, ReactionStats>;
  userProfiles: Map<string, BelroseUserProfile>;
  isLoading: boolean;
  error: string | null;
}

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

function RecordRow({
  result,
  expanded,
  onToggle,
}: {
  result: RecordCompletenessResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SectionTab>('hashes');
  const [selectedVerification, setSelectedVerification] = useState<VerificationDoc | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<DisputeDocDecrypted | null>(null);
  const [credData, setCredData] = useState<RecordCredibilityData>({
    verifications: [],
    disputes: [],
    reactionStatsMap: new Map(),
    userProfiles: new Map(),
    isLoading: false,
    error: null,
  });

  const cfg = STATUS_CONFIG[result.status];
  const recordId = result.record.id || result.record.firestoreId;

  // ── Extracted so we can call it both on first expand and after retract ──
  const loadCredData = useCallback(async () => {
    if (!recordId) return;
    setCredData(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const [verifications, disputes] = await Promise.all([
        getVerificationsByRecordId(recordId),
        getDisputesByRecordId(recordId),
      ]);

      // Fetch reaction stats for every dispute in parallel.
      // getDisputeReactionStats needs recordId, recordHash, and disputerId.
      const statsEntries = await Promise.all(
        disputes.map(async d => {
          const stats = await getDisputeReactionStats(d.recordId, d.recordHash, d.disputerId);
          return [d.id, stats] as [string, ReactionStats];
        })
      );
      const reactionStatsMap = new Map(statsEntries);

      // Collect all user IDs to batch-fetch profiles
      const userIds = [
        ...verifications.map(v => v.verifierId),
        ...disputes.map(d => d.disputerId),
      ].filter(Boolean);

      const profiles = userIds.length > 0 ? await getUserProfiles(userIds) : new Map();

      setCredData({
        verifications,
        disputes,
        reactionStatsMap,
        userProfiles: profiles,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Failed to load credibility data for record:', recordId, err);
      setCredData(prev => ({ ...prev, isLoading: false, error: 'Failed to load' }));
    }
  }, [recordId]);

  // Lazy-load on first expand
  useEffect(() => {
    if (!expanded || !recordId || credData.verifications.length > 0 || credData.isLoading) return;
    loadCredData();
  }, [expanded, recordId]);

  const handleCredibilityRoute = () => {
    setSelectedVerification(null);
    navigate(`/app/records/${recordId}?view=credibility`);
  };

  const verCount = credData.verifications.length;
  const dispCount = credData.disputes.length;

  const firestoreHashes = [
    ...(result.record.previousRecordHash ?? []),
    result.record.recordHash,
  ].filter(Boolean) as string[];

  const tabs: { id: SectionTab; label: string; count: number }[] = [
    { id: 'hashes', label: 'Hash History', count: firestoreHashes.length },
    { id: 'verifications', label: 'Verifications', count: verCount },
    { id: 'disputes', label: 'Disputes', count: dispCount },
  ];

  return (
    <>
      <div
        className="rounded-xl border transition-colors"
        style={{ borderColor: expanded ? cfg.border : undefined }}
      >
        {/* ── Collapsed header ── */}
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
          style={{ background: expanded ? cfg.bg : undefined }}
        >
          {/* Status dot */}
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />

          {/* Name + source */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {result.record.belroseFields?.title || result.record.fileName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {result.record.belroseFields?.institution || result.record.sourceType || '—'}
              {result.onChainHashes.length > 0 &&
                ` · ${result.onChainHashes.length} on-chain version${result.onChainHashes.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Credibility counts (shown once loaded) */}
          {verCount > 0 && (
            <span className="text-xs text-complement-3 bg-complement-3/10 border border-complement-3/30 rounded-full px-2 py-0.5 shrink-0">
              {verCount} verification{verCount !== 1 ? 's' : ''}
            </span>
          )}
          {dispCount > 0 && (
            <span className="text-xs text-complement-4 bg-complement-4/10 border border-complement-4/30 rounded-full px-2 py-0.5 shrink-0">
              {dispCount} dispute{dispCount !== 1 ? 's' : ''}
            </span>
          )}

          {/* Status pill */}
          <StatusPill status={result.status} />

          {/* Chevron */}
          <ChevronDown
            className="w-4 h-4 text-muted-foreground shrink-0 transition-transform"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
          />
        </button>

        {/* ── Expanded panel ── */}
        {expanded && (
          <div style={{ borderTop: `1px solid ${cfg.border}` }}>
            {/* Context callout for mismatch / traceable */}
            {result.status === 'anchored_previous_version' && (
              <div className="mx-4 mt-3 text-xs text-complement-2 bg-complement-2/10 border border-complement-2/20 rounded-lg px-3 py-2">
                This record has been edited since its last blockchain verification. A previous
                version matched on-chain — the chain of custody is intact.
              </div>
            )}
            {result.status === 'anchored_mismatch' && (
              <div className="mx-4 mt-3 text-xs text-complement-4 bg-complement-4/10 border border-complement-4/20 rounded-lg px-3 py-2">
                No version of this record — current or historical — matches any on-chain hash. The
                record may have been modified outside normal channels.
              </div>
            )}

            {/* Section tabs */}
            <div className="flex border-b border-border bg-muted/20 mt-3">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                    activeSection === tab.id
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  {(tab.count > 0 || tab.id === 'hashes') && (
                    <span
                      className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${
                        activeSection === tab.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Section content */}
            <div className="px-4 py-3 space-y-1">
              {/* HASH HISTORY */}
              {activeSection === 'hashes' && (
                <>
                  {/* Table header */}
                  <div className="flex items-center gap-3 pb-1.5 mb-1 border-b border-border">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase w-8 shrink-0">
                      Version
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase flex-1">
                      Hash
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase w-40 text-right shrink-0">
                      Status
                    </span>
                  </div>
                  {(() => {
                    const onChainSet = new Set(result.onChainHashes);

                    if (firestoreHashes.length === 0) {
                      return (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          No hash available for this record.
                        </p>
                      );
                    }

                    return [...firestoreHashes].reverse().map((hash, reversedIndex) => {
                      const originalIndex = firestoreHashes.length - 1 - reversedIndex;
                      const isCurrent = hash === result.record.recordHash;
                      const isOnChain = onChainSet.has(hash);
                      const matchType = isCurrent ? 'current' : 'previous';

                      return (
                        <HashRow
                          key={hash}
                          hash={hash}
                          index={originalIndex}
                          isCurrent={isCurrent}
                          isMatched={isOnChain}
                          matchType={matchType}
                        />
                      );
                    });
                  })()}
                </>
              )}

              {/* VERIFICATIONS */}
              {activeSection === 'verifications' && (
                <>
                  {credData.isLoading && (
                    <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
                  )}
                  {!credData.isLoading && credData.verifications.length === 0 && (
                    <div className="text-center py-6">
                      <Shield className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No verifications on record.</p>
                    </div>
                  )}
                  {credData.verifications.map(v => (
                    <VerificationUserCard
                      key={v.id}
                      verification={v}
                      userProfile={credData.userProfiles.get(v.verifierId)}
                      isInactive={!v.isActive}
                      currentRecordHash={result.record.recordHash}
                      onViewUser={() => {}}
                      onViewDetails={() => setSelectedVerification(v)}
                    />
                  ))}
                </>
              )}

              {/* DISPUTES */}

              {activeSection === 'disputes' && (
                <>
                  {credData.isLoading && (
                    <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
                  )}
                  {!credData.isLoading && credData.disputes.length === 0 && (
                    <div className="text-center py-6">
                      <AlertTriangle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No disputes on record.</p>
                    </div>
                  )}
                  {credData.disputes.map(d => {
                    const stats = credData.reactionStatsMap.get(d.id);
                    const reactionStats = {
                      supports: stats?.supports ?? 0,
                      opposes: stats?.opposes ?? 0,
                      userReaction: getReactionType(stats?.userReaction),
                    };
                    return (
                      <DisputeUserCard
                        key={d.id}
                        dispute={d}
                        userProfile={credData.userProfiles.get(d.disputerId)}
                        isInactive={!d.isActive}
                        currentRecordHash={result.record.recordHash}
                        onViewUser={() => {}}
                        onViewDetails={() => setSelectedDispute(d)}
                        reactionStats={reactionStats}
                        onReact={() => navigate(`/records/${recordId}`)}
                        isLoadingReaction={false}
                        isOwnDispute={user?.uid === d.disputerId}
                      />
                    );
                  })}
                </>
              )}

              {credData.error && (
                <p className="text-xs text-red-500 text-center py-2">{credData.error}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Verification detail modal */}
      {selectedVerification && (
        <VerificationDetailModal
          isOpen={true}
          onClose={() => setSelectedVerification(null)}
          verification={selectedVerification}
          record={result.record}
          userProfile={credData.userProfiles.get(selectedVerification.verifierId)}
          isOwnVerification={user?.uid === selectedVerification.verifierId}
          onModify={handleCredibilityRoute}
          onRetract={handleCredibilityRoute}
        />
      )}
      {selectedDispute && (
        <DisputeDetailModal
          isOpen={true}
          onClose={() => setSelectedDispute(null)}
          dispute={selectedDispute}
          record={result.record}
          userProfile={credData.userProfiles.get(selectedDispute.disputerId)}
          isOwnDispute={user?.uid === selectedDispute.disputerId}
          onModify={handleCredibilityRoute}
          onRetract={handleCredibilityRoute}
          onReact={handleCredibilityRoute}
          reactionStats={
            credData.reactionStatsMap.get(selectedDispute.id) ?? {
              supports: 0,
              opposes: 0,
              userReaction: null,
            }
          }
        />
      )}
    </>
  );
}

export default RecordRow;
