// src/features/Trustee/services/__tests__/trusteeRelationshipService.test.ts
//
// Tier 1 — the one pure helper trusteeRelationshipService.ts exports: getTrusteeRelationshipId.
// The rest of TrusteeRelationshipService talks to Firestore/blockchain directly and is covered
// by the Tier 2 orchestration suite (test/orchestration/trusteeRelationshipService.test.ts).

import { describe, it, expect } from 'vitest';
import { getTrusteeRelationshipId } from '../trusteeRelationshipService';

describe('getTrusteeRelationshipId', () => {
  it('joins trustorId and trusteeId with an underscore', () => {
    expect(getTrusteeRelationshipId('trustor-1', 'trustee-1')).toBe('trustor-1_trustee-1');
  });

  it('is order-sensitive — trustor and trustee are not interchangeable', () => {
    expect(getTrusteeRelationshipId('a', 'b')).not.toBe(getTrusteeRelationshipId('b', 'a'));
  });

  it('produces distinct ids for distinct pairs, even with overlapping ids', () => {
    const id1 = getTrusteeRelationshipId('user-1', 'user-2');
    const id2 = getTrusteeRelationshipId('user-1', 'user-23');
    expect(id1).not.toBe(id2);
  });
});
