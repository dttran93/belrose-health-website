// @vitest-environment jsdom
//
// src/features/HealthProfile/hooks/__tests__/useProfileCompleteness.test.ts
//
// Tier 1 — pure scoring/tier logic wrapped in useMemo (no Firebase/network deps), rendered via
// renderHook since it's a real hook. Covers the DONE_MAP criteria derivation (including the
// Firestore-Timestamp/Date/number/{seconds} branches of hasRecentRecord), the identity-record
// exclusion from record-quality checks, tier boundary exactness, and nextStep/pillar rollups.

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProfileCompleteness } from '../useProfileCompleteness';
import { MAX_SCORE } from '../../configs/completenessTier';
import type { GroupedHealthData } from '../../utils/fhirGroupingUtils';
import type { BelroseUserProfile, FileObject } from '@/types/core';
import type { UserIdentity } from '../../utils/parseUserIdentity';

function emptyGrouped(): GroupedHealthData {
  return new Map();
}

function groupedWith(categories: Partial<Record<string, unknown[]>>): GroupedHealthData {
  return new Map(Object.entries(categories)) as GroupedHealthData;
}

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'record-1',
    fileSize: 100,
    fileType: 'application/pdf',
    administrators: ['user-1'],
    status: 'completed',
    ...overrides,
  } as FileObject;
}

function run(input: {
  profile?: BelroseUserProfile | null;
  userIdentity?: UserIdentity | null;
  grouped?: GroupedHealthData;
  records?: FileObject[];
}) {
  const { result } = renderHook(() =>
    useProfileCompleteness({
      profile: input.profile ?? null,
      userIdentity: input.userIdentity ?? null,
      grouped: input.grouped ?? emptyGrouped(),
      records: input.records ?? [],
    })
  );
  return result.current;
}

describe('useProfileCompleteness — empty state', () => {
  it('scores 0 with every criterion incomplete and the lowest tier', () => {
    const result = run({});

    expect(result.score).toBe(0);
    expect(result.pct).toBe(0);
    expect(result.tier).toBe('Getting Started');
    expect(result.maxScore).toBe(MAX_SCORE);
    expect(result.incompleteCount).toBe(result.criteria.length);
    expect(result.nextStep?.id).toBe('dob'); // first criterion in CRITERIA_CONFIG
  });
});

describe('useProfileCompleteness — identity criteria', () => {
  it('marks dob/gender/location/idVerified done based on userIdentity + profile', () => {
    const result = run({
      userIdentity: { dateOfBirth: new Date('1990-01-01'), gender: 'female', city: 'London' },
      profile: { identityVerified: true } as any,
    });

    const byId = Object.fromEntries(result.criteria.map(c => [c.id, c.done]));
    expect(byId.dob).toBe(true);
    expect(byId.gender).toBe(true);
    expect(byId.location).toBe(true);
    expect(byId.idVerified).toBe(true);
  });

  it('accepts country as an alternative to city for the location criterion', () => {
    const result = run({ userIdentity: { country: 'UK' } });
    const location = result.criteria.find(c => c.id === 'location');
    expect(location?.done).toBe(true);
  });
});

describe('useProfileCompleteness — clinical criteria', () => {
  it('marks conditions/medications/allergies/immunizations done only when non-empty', () => {
    const result = run({
      grouped: groupedWith({ conditions: [{}], medications: [], allergies: [{}], immunizations: [{}] }),
    });

    const byId = Object.fromEntries(result.criteria.map(c => [c.id, c.done]));
    expect(byId.conditions).toBe(true);
    expect(byId.medications).toBe(false);
    expect(byId.allergies).toBe(true);
    expect(byId.immunizations).toBe(true);
  });
});

describe('useProfileCompleteness — record-quality criteria', () => {
  it('excludes the self-reported identity record from every record-quality check', () => {
    const result = run({
      records: [
        makeRecord({ id: 'identity', sourceType: 'Belrose Identity Form', credibility: { score: 900 } as any }),
        makeRecord({ id: 'r1' }),
        makeRecord({ id: 'r2' }),
      ],
    });

    // Only 2 real clinical records (identity excluded) — below the 3-record threshold,
    // and the identity record's 900 credibility score must not count either.
    const byId = Object.fromEntries(result.criteria.map(c => [c.id, c.done]));
    expect(byId.hasRecords).toBe(false);
    expect(byId.credible600).toBe(false);
    expect(byId.credible800).toBe(false);
  });

  it('requires at least 3 non-identity records for hasRecords', () => {
    const two = run({ records: [makeRecord({ id: 'a' }), makeRecord({ id: 'b' })] });
    expect(two.criteria.find(c => c.id === 'hasRecords')?.done).toBe(false);

    const three = run({
      records: [makeRecord({ id: 'a' }), makeRecord({ id: 'b' }), makeRecord({ id: 'c' })],
    });
    expect(three.criteria.find(c => c.id === 'hasRecords')?.done).toBe(true);
  });

  it('treats credible600 and credible800 as independent thresholds', () => {
    const midOnly = run({ records: [makeRecord({ credibility: { score: 650 } as any })] });
    let byId = Object.fromEntries(midOnly.criteria.map(c => [c.id, c.done]));
    expect(byId.credible600).toBe(true);
    expect(byId.credible800).toBe(false);

    const high = run({ records: [makeRecord({ credibility: { score: 900 } as any })] });
    byId = Object.fromEntries(high.criteria.map(c => [c.id, c.done]));
    expect(byId.credible600).toBe(true);
    expect(byId.credible800).toBe(true);
  });

  it('marks anchored true only when a record has blockchainInitialized true', () => {
    const result = run({
      records: [
        makeRecord({ blockchainRoleInitialization: { blockchainInitialized: false } as any }),
        makeRecord({ id: 'r2', blockchainRoleInitialization: { blockchainInitialized: true } as any }),
      ],
    });
    expect(result.criteria.find(c => c.id === 'anchored')?.done).toBe(true);
  });

  describe('recentRecord — date-shape handling', () => {
    const RECENT = new Date();

    it('recognizes a Firestore Timestamp-like object (toMillis)', () => {
      const result = run({
        records: [makeRecord({ uploadedAt: { toMillis: () => RECENT.getTime() } as any })],
      });
      expect(result.criteria.find(c => c.id === 'recentRecord')?.done).toBe(true);
    });

    it('recognizes a plain Date', () => {
      const result = run({ records: [makeRecord({ uploadedAt: RECENT as any })] });
      expect(result.criteria.find(c => c.id === 'recentRecord')?.done).toBe(true);
    });

    it('recognizes a raw millisecond number', () => {
      const result = run({ records: [makeRecord({ uploadedAt: RECENT.getTime() as any })] });
      expect(result.criteria.find(c => c.id === 'recentRecord')?.done).toBe(true);
    });

    it('recognizes a raw Firestore {seconds} object', () => {
      const result = run({
        records: [makeRecord({ uploadedAt: { seconds: Math.floor(RECENT.getTime() / 1000) } as any })],
      });
      expect(result.criteria.find(c => c.id === 'recentRecord')?.done).toBe(true);
    });

    it('is false for a record older than 6 months', () => {
      const oldMs = RECENT.getTime() - 200 * 24 * 60 * 60 * 1000;
      const result = run({ records: [makeRecord({ uploadedAt: { toMillis: () => oldMs } as any })] });
      expect(result.criteria.find(c => c.id === 'recentRecord')?.done).toBe(false);
    });

    it('falls back to createdAt when uploadedAt is absent', () => {
      const result = run({
        records: [makeRecord({ uploadedAt: undefined, createdAt: RECENT as any })],
      });
      expect(result.criteria.find(c => c.id === 'recentRecord')?.done).toBe(true);
    });

    it('is false when neither uploadedAt nor createdAt is present', () => {
      const result = run({ records: [makeRecord({ uploadedAt: undefined, createdAt: undefined })] });
      expect(result.criteria.find(c => c.id === 'recentRecord')?.done).toBe(false);
    });
  });
});

describe('useProfileCompleteness — tier boundaries', () => {
  // idVerified alone = 175. dob+gender+location = 75. Combined = 250 (< 300 -> Getting Started).
  it('stays at Getting Started just under 300', () => {
    const result = run({
      userIdentity: { dateOfBirth: new Date(), gender: 'f', city: 'x' },
      profile: { identityVerified: true } as any,
    });
    expect(result.score).toBe(250);
    expect(result.tier).toBe('Getting Started');
  });

  it('reaches Building Profile at exactly 300', () => {
    // 250 (identity) + conditions(100) - use grouped to hit exactly 350? Let's hit exactly 300:
    // identity 250 + immunizations(50) = 300
    const result = run({
      userIdentity: { dateOfBirth: new Date(), gender: 'f', city: 'x' },
      profile: { identityVerified: true } as any,
      grouped: groupedWith({ immunizations: [{}] }),
    });
    expect(result.score).toBe(300);
    expect(result.tier).toBe('Building Profile');
  });

  it('reaches Comprehensive only at 850+', () => {
    const result = run({
      userIdentity: { dateOfBirth: new Date(), gender: 'f', city: 'x' },
      profile: { identityVerified: true } as any,
      grouped: groupedWith({
        conditions: [{}],
        medications: [{}],
        allergies: [{}],
        immunizations: [{}],
      }),
      records: [
        makeRecord({ id: 'a', credibility: { score: 900 } as any }),
        makeRecord({ id: 'b' }),
        makeRecord({ id: 'c' }),
      ],
    });
    // 250 (identity) + 100+100+100+50 (clinical) + 50 (hasRecords) + 100+150 (credible) = 900
    expect(result.score).toBe(900);
    expect(result.tier).toBe('Comprehensive');
  });
});

describe('useProfileCompleteness — pillar rollups', () => {
  it('computes earned/max/pct per pillar independently', () => {
    const result = run({
      userIdentity: { dateOfBirth: new Date() }, // only dob (25 of 250 identity points)
    });

    expect(result.pillars.identity.earned).toBe(25);
    expect(result.pillars.identity.max).toBe(250);
    expect(result.pillars.identity.pct).toBe(Math.round((25 / 250) * 100));
    expect(result.pillars.clinical.earned).toBe(0);
    expect(result.pillars.records.earned).toBe(0);
  });
});
