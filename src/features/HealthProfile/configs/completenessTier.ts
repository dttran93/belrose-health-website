//src/features/HealthProfile/configs/completenessTier.ts

/**
 * Configs for Completeness Tiers used in measuring profile completeness
 *
 * Any changes to scoring weights, tier thresholds, colors/formatting
 * should be made here, hook and UI shouldn't require changes
 */

import { CompletnessPillar, PillarStats, ProfileTier } from '../hooks/useProfileCompleteness';

// ============================================================================
// TIERS — score thresholds and display
// ============================================================================

export const TIER_CONFIG = [
  { min: 0, label: 'Getting Started' as ProfileTier, color: '#6b7280' }, // supplement-4 Cool Gray
  { min: 300, label: 'Building Profile' as ProfileTier, color: '#f59f0a' }, // complement-4 Golden
  { min: 600, label: 'Well Documented' as ProfileTier, color: '#088eaf' }, // complement-2 Cyan
  { min: 850, label: 'Comprehensive' as ProfileTier, color: '#10b77f' }, // complement-3 Emerald
] satisfies { min: number; label: ProfileTier; color: string }[];

// ============================================================================
// PILLARS — colours and navigation targets
// ============================================================================

export const PILLAR_CONFIG: Record<
  CompletnessPillar,
  Omit<PillarStats, 'earned' | 'max' | 'pct'>
> = {
  identity: {
    label: 'Identity & Trust',
    color: '#372fa2', // complement-1  Light Navy
    trackColor: '#c7d2fe', // indigo-200 — close match to complement-1 light
    bgColor: '#eef2ff', // indigo-50
  },
  clinical: {
    label: 'Clinical Completeness',
    color: '#10b77f', // complement-3  Emerald Accent
    trackColor: '#a7f3d0', // emerald-200
    bgColor: '#ecfdf5', // emerald-50
  },
  records: {
    label: 'Records Reliability',
    color: '#743df5', // complement-5  Violet Accent
    trackColor: '#ddd6fe', // violet-200
    bgColor: '#f5f3ff', // violet-50
  },
};

// Maps pillar → the tab to navigate to for actions
export const PILLAR_TAB_MAP: Record<CompletnessPillar, string> = {
  identity: 'identity',
  clinical: 'summary',
  records: 'records',
};

export const PILLAR_TAB_LABEL: Record<CompletnessPillar, string> = {
  identity: 'Go to Identity',
  clinical: 'Go to Summary',
  records: 'Go to Records',
};

// ============================================================================
// CRITERIA — points and hints per criterion id
//
// The `done` field is computed at runtime by the hook from real data.
// Everything static lives here so weights and hints can be tuned without
// touching the hook logic.
// ============================================================================

export interface CompletnessCriterionConfig {
  id: string;
  pillar: CompletnessPillar;
  label: string;
  points: number;
  hint?: string;
}

// ── Build criteria list ──────────────────────────────────────────────────
export const CRITERIA_CONFIG: CompletnessCriterionConfig[] = [
  // ── IDENTITY PILLAR ───────────────────────────────────────────────────
  {
    id: 'dob',
    pillar: 'identity',
    label: 'Date of birth',
    points: 25,
    hint: 'Fill in your name and date of birth in the Identity tab',
  },
  {
    id: 'gender',
    pillar: 'identity',
    label: 'Gender recorded',
    points: 25,
    hint: 'Add your gender in the Identity tab',
  },
  {
    id: 'location',
    pillar: 'identity',
    label: 'Location on file',
    points: 25,
    hint: 'Add your city or country in the Identity tab',
  },
  {
    id: 'idVerified',
    pillar: 'identity',
    label: 'Identity verified',
    points: 175,
    hint: 'Verify your identity via the Identity tab to unlock full trust features',
  },

  // ── CLINICAL PILLAR ───────────────────────────────────────────────────
  {
    id: 'conditions',
    pillar: 'clinical',
    label: 'Conditions recorded',
    points: 100,
    hint: 'Upload a record containing a condition, or explicitly confirm you have no active conditions',
  },
  {
    id: 'medications',
    pillar: 'clinical',
    label: 'Medications recorded',
    points: 100,
    hint: 'Upload a record containing a medication or prescription or confirm you have no active medications',
  },
  {
    id: 'allergies',
    pillar: 'clinical',
    label: 'Allergies recorded',
    points: 100,
    hint: 'Upload a record with allergy info, or explicitly confirm "no known allergies"',
  },
  {
    id: 'immunizations',
    pillar: 'clinical',
    label: 'Immunizations on file',
    points: 50,
    hint: 'Upload a vaccination record or immunization history',
  },
  {
    id: 'hasRecords',
    pillar: 'clinical',
    label: '3+ records uploaded',
    points: 50,
    hint: 'Upload a vaccination record or immunization history',
  },

  // ── RECORDS PILLAR ────────────────────────────────────────────────────
  {
    id: 'credible600',
    pillar: 'records',
    label: 'At least one record with credibility score over 600',
    points: 100,
    hint: 'Have a provider verify your records to increase its credibility score',
  },
  {
    id: 'credible800',
    pillar: 'records',
    label: 'At least one record with credibility score over 800',
    points: 150,
    hint: 'Have a highly trusted provider verify your records to increase its credibility score',
  },
  {
    id: 'recentRecord',
    pillar: 'records',
    label: 'Record uploaded in last 6 months',
    points: 50,
    hint: 'Keep your profile current by uploading a recent record',
  },
  {
    id: 'anchored',
    pillar: 'records',
    label: 'Record anchored on distributed network',
    points: 50,
    hint: 'Anchor a record to the distributed network to make it tamper-proof',
  },
];

export const MAX_SCORE = CRITERIA_CONFIG.reduce((s, c) => s + c.points, 0);
