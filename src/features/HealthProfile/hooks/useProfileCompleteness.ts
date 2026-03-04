// src/features/HealthProfile/hooks/useProfileCompleteness.ts

/**
 * useProfileCompleteness
 *
 * Computes a profile completeness score across three pillars:
 *   - Identity & Trust   (name, DOB, location, ID verified, blockchain linked)
 *   - Clinical Completeness   (conditions, medications, allergies, immunizations)
 *   - Record Reliability     (upload count, credible record, anchored record, recency)
 */

import { useMemo } from 'react';
import { BelroseUserProfile, FileObject } from '@/types/core';
import { UserIdentity } from '../utils/parseUserIdentity';
import { GroupedHealthData } from '../utils/fhirGroupingUtils';
import {
  CRITERIA_CONFIG,
  MAX_SCORE,
  PILLAR_CONFIG,
  TIER_CONFIG,
} from '../configs/completenessTier';

// ============================================================================
// TYPES
// ============================================================================

export type CompletnessPillar = 'identity' | 'clinical' | 'records';

export interface CompletnessCriterion {
  id: string;
  pillar: CompletnessPillar;
  label: string;
  points: number;
  done: boolean;
  hint?: string;
}

export interface PillarStats {
  label: string;
  earned: number;
  max: number;
  pct: number;
  color: string; // solid colour — text, icons, filled bar
  trackColor: string; // lighter background track
  bgColor: string; // very light tint for row backgrounds
}

export type ProfileTier =
  | 'Getting Started'
  | 'Building Profile'
  | 'Well Documented'
  | 'Comprehensive';

export interface ProfileCompletenessResult {
  /** All individual criteria with done/not-done status */
  criteria: CompletnessCriterion[];
  /** Per-pillar rolled-up stats */
  pillars: Record<CompletnessPillar, PillarStats>;
  /** Total points earned */
  score: number;
  /** Maximum possible points */
  maxScore: number;
  /** 0–100 percentage */
  pct: number;
  /** Named tier */
  tier: ProfileTier;
  /** Colour for the current tier (for inline styles) */
  tierColor: string;
  /** First incomplete criterion — useful for "Next step" nudge */
  nextStep: CompletnessCriterion | null;
  /** How many criteria are still incomplete */
  incompleteCount: number;
}

// ============================================================================
// CONFIG
// ============================================================================

// 6 Months in milliseconds — used for "recent record" check
const RECENT_THRESHOLD_MS = 180 * 24 * 60 * 60 * 1000;

// Minimum number of records to earn the "has records" criterion
const MIN_RECORD_COUNT = 3;

// ============================================================================
// HELPERS
// ============================================================================

function getTier(score: number): { min: number; label: ProfileTier; color: string } {
  for (let i = TIER_CONFIG.length - 1; i >= 0; i--) {
    const tier = TIER_CONFIG[i];
    if (tier && score >= tier.min) return tier;
  }
  return TIER_CONFIG[0]!;
}

function buildPillarStats(
  criteria: CompletnessCriterion[],
  pillar: CompletnessPillar
): PillarStats {
  const pc = criteria.filter(c => c.pillar === pillar);
  const earned = pc.filter(c => c.done).reduce((s, c) => s + c.points, 0);
  const max = pc.reduce((s, c) => s + c.points, 0);
  return {
    ...PILLAR_CONFIG[pillar],
    earned,
    max,
    pct: max > 0 ? Math.round((earned / max) * 100) : 0,
  };
}

// ============================================================================
// HOOK
// ============================================================================

export interface UseProfileCompletenessInput {
  /** From BelroseUserProfile — identity verification + wallet */
  profile: BelroseUserProfile | null;
  /** Parsed identity form fields — name, DOB, location etc. */
  userIdentity: UserIdentity | null;
  /** FHIR grouped data from useHealthProfile */
  grouped: GroupedHealthData;
  /** Raw records for quality checks (count, credibility, recency, anchoring) */
  records: FileObject[];
}

export function useProfileCompleteness({
  profile,
  userIdentity,
  grouped,
  records,
}: UseProfileCompletenessInput): ProfileCompletenessResult {
  return useMemo(() => {
    // ── Clinical FHIR category checks ───────────────────────────────────────
    // grouped.get('conditions') returns [] if empty, never undefined
    const hasConditions = (grouped.get('conditions') ?? []).length > 0;
    const hasMedications = (grouped.get('medications') ?? []).length > 0;
    const hasAllergies = (grouped.get('allergies') ?? []).length > 0;
    const hasImmunizations = (grouped.get('immunizations') ?? []).length > 0;

    // ── Record quality checks ────────────────────────────────────────────────
    // Filter out the identity record itself — it shouldn't count toward
    // "record quality" since it's not a clinical record
    const clinicalRecords = records.filter(r => r.sourceType !== 'Belrose Identity Form');

    const hasEnoughRecords = clinicalRecords.length >= MIN_RECORD_COUNT;
    const credibleRecord600 = clinicalRecords.some(r => (r.credibility?.score ?? 0) >= 600);
    const credibleRecord800 = clinicalRecords.some(r => (r.credibility?.score ?? 0) >= 800);
    const hasAnchoredRecord = clinicalRecords.some(
      r => r.blockchainRoleInitialization?.blockchainInitialized === true
    );
    const now = Date.now();
    const hasRecentRecord = clinicalRecords.some(r => {
      const raw = r.uploadedAt ?? r.createdAt;
      if (!raw) return false;

      // Handle Firestore Timestamp, plain Date, or raw number
      const ms =
        typeof (raw as any).toMillis === 'function'
          ? (raw as any).toMillis()
          : raw instanceof Date
            ? raw.getTime()
            : typeof raw === 'number'
              ? raw
              : typeof (raw as any).seconds === 'number'
                ? (raw as any).seconds * 1000 // ← this one
                : null;

      return ms !== null && now - ms < RECENT_THRESHOLD_MS;
    });

    // ── Map criterion id → done ───────────────────────────────────────────────
    // Adding a new criterion? Add its id + evaluation here, then add the
    // static config (label, points, hint) to completenessConfig.ts.
    const DONE_MAP: Record<string, boolean> = {
      dob: !!userIdentity?.dateOfBirth,
      gender: !!userIdentity?.gender,
      location: !!(userIdentity?.city || userIdentity?.country),
      idVerified: profile?.identityVerified === true,
      conditions: hasConditions,
      medications: hasMedications,
      allergies: hasAllergies,
      immunizations: hasImmunizations,
      hasRecords: hasEnoughRecords,
      credible600: credibleRecord600,
      credible800: credibleRecord800,
      recentRecord: hasRecentRecord,
      anchored: hasAnchoredRecord,
    };

    // Build criteria by merging static config with runtime done values
    const criteria: CompletnessCriterion[] = CRITERIA_CONFIG.map(c => ({
      ...c,
      done: DONE_MAP[c.id] ?? false,
    }));

    // ── Totals ───────────────────────────────────────────────────────────────
    const score = criteria.filter(c => c.done).reduce((s, c) => s + c.points, 0);
    const pct = Math.round((score / MAX_SCORE) * 100);
    const { label: tier, color: tierColor } = getTier(score);

    // ── Pillar stats ─────────────────────────────────────────────────────────
    const pillars = {
      identity: buildPillarStats(criteria, 'identity'),
      clinical: buildPillarStats(criteria, 'clinical'),
      records: buildPillarStats(criteria, 'records'),
    };

    const incomplete = criteria.filter(c => !c.done);

    return {
      criteria,
      pillars,
      score,
      maxScore: MAX_SCORE,
      pct,
      tier,
      tierColor,
      nextStep: incomplete[0] ?? null,
      incompleteCount: incomplete.length,
    };
  }, [profile, userIdentity, grouped, records]);
}
