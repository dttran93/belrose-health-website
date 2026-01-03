//src/features/Credibility/services/credibilityService.ts

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { VerificationDoc } from './verificationService';
import { DisputeDoc } from './disputeService';
import { RecordViewDoc } from '@/features/ViewEditRecord/services/logRecordViewService';

/**
 * This is the service that calculates the credibility scores based on record reviews and users
 * Scores range from 1-100 and are meant to represent the percentage chance a future user of the
 * record can rely on the record to be complete and accurate
 *
 * Record Credibility =
 * Base Score
 * + Verifications
 * + Implicit Review Bonus
 * - Disputes
 *
 * User Credibility =
 * Average Credibility Score of records in which they are an Admin or Owner or Subject
 * + Verification Accuracy
 * + Dispute Accuracy
 * + Identity Verification Bonus
 * + Verified Healthcare Provider Bonus
 * - Flag Penalties
 *
 */

// ==================== TYPES ====================

// Collection: userScores/{odysId}
export interface UserScoreDoc {
  userId: string;

  // Current stats (for quick display)
  //Average Record Score of Records in Which the User is an Admin, Owner, or Subject
  averageRecordScore: number;
  recordCount: number;

  //Verification accuracy
  totalVerificationsGiven: number;
  totalVerificationsDisputed: number;

  //Dispute Accuracy
  totalDisputesFiled: number;
  totalDisputesSupported: number;
  totalUnacceptedFlags: number;

  credibilityScore: number;

  lastCalculatedAt: Timestamp;
  calculationVersion: number;
}

// Subcollection: userScores/{odysId}/history/{autoId}
export interface ScoreHistoryDoc {
  // Snapshot of scores at this point
  credibilityScore: number;

  // Stats at time of calculation
  //Average Record Score of Records in Which the User is an Admin, Owner, or Subject
  averageRecordScore: number;
  recordCount: number;

  //Verification accuracy
  totalVerificationsGiven: number;
  totalVerificationsDisputed: number;

  //Dispute Accuracy
  totalDisputesFiled: number;
  totalDisputesSupported: number;
  totalUnacceptedFlags: number;

  // Metadata
  calculatedAt: Timestamp;
  calculationVersion: number;

  // Optional: what triggered this recalc
  trigger?: 'scheduled' | 'verification' | 'dispute' | 'dispute-reaction' | 'manual';
}

// ==================== CONSTANTS ====================

const VERIFICATION_WEIGHTS = {
  Provenance: 10,
  Content: 15,
  Full: 25,
};

const SEVERITY_WEIGHTS = {
  Negligible: 5,
  Moderate: 15,
  Major: 30,
};

const CULPABILITY_MULTIPLIERS = {
  NoFault: 0.5,
  Systemic: 0.75,
  Preventable: 1.0,
  Reckless: 1.5,
  Intentional: 2.0,
};

const BASE_SCORE = 50;
const MAX_VERIFICATION_BONUS = 50;
const MAX_IMPLICIT_BONUS = 20;

export async function recalculateScores(
  recordHash: string,
  recordId: string,
  triggerUserIdHash: string
): Promise<void> {
  await recalculateHashScore(recordHash);
  await recalculateRecordScore(recordId);
  await recalculateUserScore(triggerUserIdHash);
}

export async function recalculateHashScore(recordHash: string): Promise<number> {
  // Fetch all data from Firebase (fast!)
  const db = getFirestore();
  const [verificationsSnap, disputesSnap, viewsSnap] = await Promise.all([
    db.collection('verifications').where('recordHash', '==', recordHash).get(),
    db.collection('disputes').where('recordHash', '==', recordHash).get(),
    db.collection('recordViews').where('recordHash', '==', recordHash).get(),
  ]);

  const verifications = verificationsSnap.docs.map(d => d.data() as VerificationDoc);
  const disputes = disputesSnap.docs.map(d => d.data() as DisputeDoc);
  const views = viewsSnap.docs.map(d => d.data() as RecordViewDoc);

  // Get all unique user IDs for provider scores
  const allUserIds = new Set<string>();
  verifications.forEach(v => allUserIds.add(v.verifierId));
  disputes.forEach(d => allUserIds.add(d.disputerId));
  views.forEach(v => allUserIds.add(v.viewerId));

  // Fetch provider scores
  const providerScores = new Map<string, number>();
  const userScoresSnap = await db
    .collection('userScores')
    .where('odysIdHash', 'in', Array.from(allUserIds).slice(0, 10)) // Firestore limit
    .get();

  userScoresSnap.docs.forEach(doc => {
    const data = doc.data() as UserScoreDoc;
    providerScores.set(data.odysIdHash, data.providerScore);
  });

  // Fetch reactions for disputes
  const reactions = new Map<string, ReactionDoc[]>();
  for (const dispute of disputes) {
    const reactionsSnap = await db
      .collection('reactions')
      .where('disputeId', '==', dispute.id)
      .get();
    reactions.set(
      dispute.disputerIdHash,
      reactionsSnap.docs.map(d => d.data() as ReactionDoc)
    );
  }

  // Calculate verification bonus
  let verificationBonus = 0;
  let provenanceCount = 0;
  let contentCount = 0;
  let fullCount = 0;

  for (const v of verifications) {
    if (!v.isActive) continue;

    const baseWeight = VERIFICATION_WEIGHTS[v.level] || 0;
    const providerScore = providerScores.get(v.verifierIdHash) ?? 50;
    const multiplier = getProviderMultiplier(providerScore);

    verificationBonus += baseWeight * multiplier;

    if (v.level === 'Provenance') provenanceCount++;
    else if (v.level === 'Content') contentCount++;
    else if (v.level === 'Full') fullCount++;
  }
  verificationBonus = Math.min(verificationBonus, MAX_VERIFICATION_BONUS);

  // Calculate implicit review bonus
  const verifierIds = new Set(verifications.filter(v => v.isActive).map(v => v.verifierIdHash));
  const disputerIds = new Set(disputes.filter(d => d.isActive).map(d => d.disputerIdHash));
  const now = Date.now();
  let implicitBonus = 0;
  let implicitCount = 0;

  for (const view of views) {
    if (verifierIds.has(view.viewerIdHash) || disputerIds.has(view.viewerIdHash)) continue;

    const daysSinceView = (now - view.viewedAt.toMillis()) / (1000 * 60 * 60 * 24);
    if (daysSinceView < 7) continue;

    implicitCount++;

    let timeWeight: number;
    if (daysSinceView < 30) timeWeight = 1.0;
    else if (daysSinceView < 90) timeWeight = 1.5;
    else timeWeight = 2.0;

    const providerScore = providerScores.get(view.viewerIdHash) ?? 50;
    const multiplier = getProviderMultiplier(providerScore);

    implicitBonus += 3 * timeWeight * multiplier;
  }
  implicitBonus = Math.min(implicitBonus, MAX_IMPLICIT_BONUS);

  // Calculate dispute penalty
  let disputePenalty = 0;
  let activeDisputeCount = 0;

  for (const d of disputes) {
    if (!d.isActive) continue;
    activeDisputeCount++;

    const severityWeight = SEVERITY_WEIGHTS[d.severity] || 0;
    const culpabilityMultiplier = CULPABILITY_MULTIPLIERS[d.culpability] || 1;

    const disputerScore = providerScores.get(d.disputerIdHash) ?? 50;
    const disputerMultiplier = getProviderMultiplier(disputerScore);

    const disputeReactions = reactions.get(d.disputerIdHash) || [];
    let weightedSupports = 0;
    let weightedOpposes = 0;

    for (const r of disputeReactions) {
      if (!r.isActive) continue;

      const reactorScore = providerScores.get(r.reactorIdHash) ?? 50;
      const reactorMultiplier = getProviderMultiplier(reactorScore);

      if (r.supportsDispute) {
        weightedSupports += reactorMultiplier;
      } else {
        weightedOpposes += reactorMultiplier;
      }
    }

    const reactionAdjustment = (weightedSupports + 1) / (weightedSupports + weightedOpposes + 1);

    disputePenalty +=
      severityWeight * culpabilityMultiplier * disputerMultiplier * reactionAdjustment;
  }

  // Final score
  const score = Math.max(
    0,
    Math.min(100, BASE_SCORE + verificationBonus + implicitBonus - disputePenalty)
  );

  const roundedScore = Math.round(score);

  // Cache the score
  const recordId = verifications[0]?.recordId || disputes[0]?.recordId || '';

  await db
    .collection('hashScores')
    .doc(recordHash)
    .set({
      recordHash,
      recordId,
      score: roundedScore,
      breakdown: {
        baseScore: BASE_SCORE,
        verificationBonus: Math.round(verificationBonus),
        implicitReviewBonus: Math.round(implicitBonus),
        disputePenalty: Math.round(disputePenalty),
      },
      stats: {
        activeVerifications: verifications.filter(v => v.isActive).length,
        provenanceCount,
        contentCount,
        fullCount,
        activeDisputes: activeDisputeCount,
        implicitReviews: implicitCount,
      },
      lastCalculated: Timestamp.now(),
    });

  return roundedScore;
}

/**
 *
 * @param recordId
 * @returns
 */
export async function recalculateRecordScore(recordId: string): Promise<number> {
  // Get all hash scores for this record
  const hashScoresSnap = await db.collection('hashScores').where('recordId', '==', recordId).get();

  if (hashScoresSnap.empty) {
    return BASE_SCORE;
  }

  const hashScores = hashScoresSnap.docs.map(d => d.data() as HashScoreDoc);
  const now = Date.now();

  // Weight by recency
  let weightedSum = 0;
  let totalWeight = 0;

  for (const hash of hashScores) {
    const daysSince = (now - hash.lastCalculated.toMillis()) / (1000 * 60 * 60 * 24);
    const recencyWeight = 1 / (1 + daysSince / 365);

    weightedSum += hash.score * recencyWeight;
    totalWeight += recencyWeight;
  }

  const score = Math.round(weightedSum / totalWeight);

  // Get subject count
  const subjectsSnap = await db
    .collection('recordSubjects')
    .where('recordId', '==', recordId)
    .get();

  const activeSubjects = subjectsSnap.docs.filter(d => d.data().isActive).length;

  await db.collection('recordScores').doc(recordId).set({
    recordId,
    score,
    hashCount: hashScores.length,
    activeSubjects,
    lastCalculated: Timestamp.now(),
  });

  return score;
}
