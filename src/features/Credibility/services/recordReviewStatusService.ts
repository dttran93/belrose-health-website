// src/features/Credibility/services/recordReviewStatusService.ts

/**
 * Aggregates a user's review activity (verifications, disputes, reactions)
 * for a single record, including whether each review is current or stale
 * relative to the record's current content hash.
 *
 * Used by:
 * - recordRefinementService — to inform the AI about review status
 * - Future: record detail UI, health profile views
 *
 * All checks use Firestore (not blockchain) since chainStatus on each
 * document already confirms on-chain status, and Firestore is faster.
 */

import { getVerification, VerificationLevelOptions } from './verificationService';
import {
  getDisputesByRecordId,
  getDisputeReactions,
  DisputeSeverityOptions,
} from './disputeService';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecordReviewStatus {
  // ── Verification ────────────────────────────────────────────────────────────
  hasVerification: boolean;
  verificationIsCurrentHash: boolean; // false if verified against an older hash
  verificationLevel?: VerificationLevelOptions;

  // ── Dispute ─────────────────────────────────────────────────────────────────
  hasDispute: boolean;
  disputeIsCurrentHash: boolean; // false if disputed against an older hash
  disputeSeverity?: DisputeSeverityOptions;

  // ── Reaction ─────────────────────────────────────────────────────────────────
  // A reaction is tied to a specific dispute, so staleness is inherited:
  // if the dispute it was made against is stale, the reaction is stale too.
  hasReaction: boolean;
  reactionIsCurrentHash: boolean;
  reactionSupportsDispute?: boolean; // true = supported, false = opposed

  // ── Derived convenience flags ────────────────────────────────────────────────
  hasAnyActiveReview: boolean; // any of the three is active
  hasStaleReview: boolean; // any review exists but against an old hash
  currentHashReviewed: boolean; // at least one review is against current hash
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Fetches the full review status for a specific user on a specific record.
 *
 * @param recordId - Firestore record ID
 * @param currentRecordHash - The record's current hash (from record document)
 * @param userId - The user whose review activity to check
 *
 * Pass currentRecordHash from the record document directly rather than
 * fetching it here — callers already have the record data and this avoids
 * an extra Firestore read.
 */
export async function getRecordReviewStatus(
  recordId: string,
  currentRecordHash: string | undefined,
  userId: string
): Promise<RecordReviewStatus> {
  // ── Default (no-hash) fallback ───────────────────────────────────────────────
  // Older records or virtual files may not have a recordHash yet.
  // Return a safe default rather than throwing.
  if (!currentRecordHash) {
    return {
      hasVerification: false,
      verificationIsCurrentHash: false,
      hasDispute: false,
      disputeIsCurrentHash: false,
      hasReaction: false,
      reactionIsCurrentHash: false,
      hasAnyActiveReview: false,
      hasStaleReview: false,
      currentHashReviewed: false,
    };
  }

  // ── Fetch verification and all disputes on the record in parallel ─────────────
  // We need all disputes (not just the user's) to check reactions,
  // since reactions are tied to a disputerId + recordHash combination.
  const [verification, allDisputes] = await Promise.all([
    getVerification(currentRecordHash, userId).catch(() => null),
    getDisputesByRecordId(recordId).catch(() => []),
  ]);

  // ── Verification ─────────────────────────────────────────────────────────────
  // getVerification is keyed by {recordHash}_{userId} so it only returns
  // a result if the user verified this specific hash. To check if they
  // verified an older hash, we'd need to query all their verifications —
  // but for now we check the current hash and treat absence as "not verified
  // or verified against a stale hash." A future improvement could query
  // previousRecordHash[] to detect stale verifications explicitly.
  const hasVerification = !!verification?.isActive;
  const verificationIsCurrentHash = hasVerification;
  const verificationLevel = verification?.level;

  // ── Dispute ──────────────────────────────────────────────────────────────────
  // The user's dispute for the current hash
  const userDisputeCurrentHash = allDisputes.find(
    d => d.disputerId === userId && d.recordHash === currentRecordHash && d.isActive
  );

  // The user's dispute for any previous hash (stale)
  const userDisputeStaleHash = !userDisputeCurrentHash
    ? allDisputes.find(
        d => d.disputerId === userId && d.recordHash !== currentRecordHash && d.isActive
      )
    : undefined;

  const hasDispute = !!(userDisputeCurrentHash || userDisputeStaleHash);
  const disputeIsCurrentHash = !!userDisputeCurrentHash;
  const disputeSeverity = (userDisputeCurrentHash || userDisputeStaleHash)?.severity;

  // ── Reactions ─────────────────────────────────────────────────────────────────
  // Check if the user has reacted to any active dispute on this record.
  // A reaction is stale if the dispute it was made against is for an old hash.
  // We check all disputes (any user's) and look for the current user as reactor.
  let hasReaction = false;
  let reactionIsCurrentHash = false;
  let reactionSupportsDispute: boolean | undefined;

  if (allDisputes.length > 0) {
    // Only check disputes where the user is NOT the disputer
    // (you can't react to your own dispute)
    const otherUsersDisputes = allDisputes.filter(d => d.disputerId !== userId && d.isActive);

    // Fetch reactions for each dispute in parallel, looking for the current user
    const reactionChecks = await Promise.all(
      otherUsersDisputes.map(async dispute => {
        const reactions = await getDisputeReactions(
          recordId,
          dispute.recordHash,
          dispute.disputerId,
          true // activeOnly
        ).catch(() => []);

        const userReaction = reactions.find(r => r.reactorId === userId);
        return userReaction
          ? {
              found: true,
              isCurrent: dispute.recordHash === currentRecordHash,
              supportsDispute: userReaction.supportsDispute,
            }
          : null;
      })
    );

    const foundReaction = reactionChecks.find(r => r !== null);
    if (foundReaction) {
      hasReaction = true;
      reactionIsCurrentHash = foundReaction.isCurrent;
      reactionSupportsDispute = foundReaction.supportsDispute;
    }
  }

  // ── Derived flags ─────────────────────────────────────────────────────────────
  const hasAnyActiveReview = hasVerification || hasDispute || hasReaction;

  const hasStaleReview =
    (hasVerification && !verificationIsCurrentHash) ||
    (hasDispute && !disputeIsCurrentHash) ||
    (hasReaction && !reactionIsCurrentHash);

  const currentHashReviewed =
    verificationIsCurrentHash || disputeIsCurrentHash || reactionIsCurrentHash;

  return {
    hasVerification,
    verificationIsCurrentHash,
    verificationLevel,
    hasDispute,
    disputeIsCurrentHash,
    disputeSeverity,
    hasReaction,
    reactionIsCurrentHash,
    reactionSupportsDispute,
    hasAnyActiveReview,
    hasStaleReview,
    currentHashReviewed,
  };
}
