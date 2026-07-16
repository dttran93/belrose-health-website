// src/features/Trustee/hooks/__tests__/useRecordTrusteesHelpers.test.ts
//
// Tier 1 — the one pure helper useRecordTrustees.ts exports: chunk. No React/hook rendering
// involved. The hook itself (Firestore chunked `in` queries, map-building) is covered by the
// Tier 3 suite (useRecordTrustees.test.ts) in this same folder.

import { describe, it, expect } from 'vitest';
import { chunk } from '../useRecordTrustees';

describe('chunk', () => {
  it('splits an array into groups of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single chunk when the array is smaller than the chunk size', () => {
    expect(chunk([1, 2], 30)).toEqual([[1, 2]]);
  });

  it('returns an empty array when given an empty array', () => {
    expect(chunk([], 30)).toEqual([]);
  });

  it('produces exactly full-size chunks when the array divides evenly', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it('mirrors the real 30-item Firestore `in` cap on a larger input', () => {
    const ids = Array.from({ length: 65 }, (_, i) => `id-${i}`);
    const result = chunk(ids, 30);

    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(30);
    expect(result[1]).toHaveLength(30);
    expect(result[2]).toHaveLength(5);
  });

  it('does not mutate the original array', () => {
    const original = [1, 2, 3];
    chunk(original, 2);
    expect(original).toEqual([1, 2, 3]);
  });
});
