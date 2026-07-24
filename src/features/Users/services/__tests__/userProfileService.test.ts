// src/features/Users/services/__tests__/userProfileService.test.ts
//
// Regression test for a real bug: getUserProfile builds its returned object from an explicit
// field whitelist rather than spreading userData, so any field added to BelroseUserProfile
// without also being added here silently disappears — isDependent/dependentCreatedBy/
// handoffInitiatedAt were dropped this way, which made DependentsSettingsPage's "Delete
// account" vs "Remove guardian access" menu-item logic always fall through to the latter.
// Pins that these three fields (and the rest of the whitelist) survive the round-trip.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getDocMock } = vi.hoisted(() => ({ getDocMock: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDoc: getDocMock,
}));

import { getUserProfile, clearUserCache } from '../userProfileService';

function fakeDocSnapshot(data: Record<string, unknown>) {
  return { exists: () => true, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
  clearUserCache();
});

describe('getUserProfile', () => {
  it('returns null when the user document does not exist', async () => {
    getDocMock.mockResolvedValue({ exists: () => false });
    expect(await getUserProfile('nonexistent')).toBeNull();
  });

  it('carries dependent-account fields through to the returned profile', async () => {
    const handoffInitiatedAt = { seconds: 1234567890, nanoseconds: 0 };
    getDocMock.mockResolvedValue(
      fakeDocSnapshot({
        displayName: 'Jane Dependent',
        isDependent: true,
        dependentCreatedBy: 'guardian-1',
        handoffInitiatedAt,
      })
    );

    const profile = await getUserProfile('dep-1');

    expect(profile?.isDependent).toBe(true);
    expect(profile?.dependentCreatedBy).toBe('guardian-1');
    expect(profile?.handoffInitiatedAt).toBe(handoffInitiatedAt);
  });

  it('leaves dependent-account fields undefined for a non-dependent user', async () => {
    getDocMock.mockResolvedValue(fakeDocSnapshot({ displayName: 'Regular User' }));

    const profile = await getUserProfile('user-1');

    expect(profile?.isDependent).toBeUndefined();
    expect(profile?.dependentCreatedBy).toBeUndefined();
    expect(profile?.handoffInitiatedAt).toBeUndefined();
  });
});
