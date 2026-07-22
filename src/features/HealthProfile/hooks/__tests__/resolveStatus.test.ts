// src/features/HealthProfile/hooks/__tests__/resolveStatus.test.ts
//
// Tier 1 — resolveStatus is useBlockchainCompleteness's pure ~7-branch state machine over
// hash/version/verification/dispute combinations (exported specifically to test in isolation).
// Covers every status outcome, the isLatestHash index check, and the "search previous hashes
// newest-first but upgrade to a verified match even if an unverified one was found first" rule.

import { describe, it, expect } from 'vitest';
import { resolveStatus } from '../useBlockchainCompleteness';

const RECORD_ID = 'record-1';

function run(
  currentHash: string | null | undefined,
  previousHashes: string[] | null | undefined,
  opts: {
    anchored?: boolean;
    onChainHashes?: string[];
    verified?: Record<string, number>;
    disputed?: Record<string, number>;
  } = {}
) {
  const anchoredRecordIds = new Set(opts.anchored === false ? [] : [RECORD_ID]);
  const versionHistoryMap = new Map([[RECORD_ID, opts.onChainHashes ?? []]]);
  const verificationStatsMap = new Map(Object.entries(opts.verified ?? {}));
  const disputeStatsMap = new Map(Object.entries(opts.disputed ?? {}));

  return resolveStatus(
    currentHash,
    previousHashes,
    RECORD_ID,
    anchoredRecordIds,
    versionHistoryMap,
    verificationStatsMap,
    disputeStatsMap
  );
}

describe('resolveStatus', () => {
  it('returns no_hash when there is no current hash', () => {
    expect(run(null, [])).toMatchObject({ status: 'no_hash', hasVerification: false });
    expect(run(undefined, [])).toMatchObject({ status: 'no_hash' });
  });

  it('returns not_anchored when the record is not in anchoredRecordIds', () => {
    const result = run('0xabc', [], { anchored: false });
    expect(result).toMatchObject({ status: 'not_anchored', onChainHashes: [] });
  });

  it('returns anchored_match with hasVerification when the current hash is on-chain and verified', () => {
    const result = run('0xabc', [], {
      onChainHashes: ['0xabc'],
      verified: { '0xabc': 1 },
    });
    expect(result).toMatchObject({
      status: 'anchored_match',
      hasVerification: true,
      isLatestHash: true,
    });
  });

  it('returns anchored_match without verification when on-chain but unverified (self-reported)', () => {
    const result = run('0xabc', [], { onChainHashes: ['0xabc'] });
    expect(result).toMatchObject({ status: 'anchored_match', hasVerification: false });
  });

  it('carries hasDispute through for a verified-but-disputed current hash', () => {
    const result = run('0xabc', [], {
      onChainHashes: ['0xabc'],
      verified: { '0xabc': 1 },
      disputed: { '0xabc': 1 },
    });
    expect(result).toMatchObject({ status: 'anchored_match', hasVerification: true, hasDispute: true });
  });

  it('returns anchored_previous_version when the current hash is stale but an old one is on-chain and verified', () => {
    const result = run('0xnew', ['0xold'], {
      onChainHashes: ['0xold'],
      verified: { '0xold': 1 },
    });
    expect(result).toMatchObject({
      status: 'anchored_previous_version',
      matchedPreviousHash: '0xold',
      hasVerification: true,
    });
  });

  it('returns anchored_previous_version unverified when the matched previous hash has no verification', () => {
    const result = run('0xnew', ['0xold'], { onChainHashes: ['0xold'] });
    expect(result).toMatchObject({
      status: 'anchored_previous_version',
      matchedPreviousHash: '0xold',
      hasVerification: false,
    });
  });

  it('prefers current-hash verification over a verified previous hash', () => {
    const result = run('0xnew', ['0xold'], {
      onChainHashes: ['0xold', '0xnew'],
      verified: { '0xold': 1, '0xnew': 1 },
    });
    expect(result.status).toBe('anchored_match');
  });

  it('searches previous hashes newest-first but upgrades to a verified match found later', () => {
    // previousRecordHash is chronological oldest->newest: ['0xA' (oldest), '0xB' (newer)].
    // Reversed iteration hits '0xB' first (unverified), then '0xA' (verified) — must upgrade.
    const result = run('0xcurrent-not-onchain', ['0xA', '0xB'], {
      onChainHashes: ['0xA', '0xB'],
      verified: { '0xA': 1 }, // only the older hash is verified
    });
    expect(result).toMatchObject({ matchedPreviousHash: '0xA', hasVerification: true });
  });

  it('returns anchored_mismatch when the record is anchored but nothing on file matches on-chain', () => {
    const result = run('0xcurrent', ['0xold'], { onChainHashes: ['0xsomethingelse'] });
    expect(result).toMatchObject({ status: 'anchored_mismatch', hasVerification: false });
  });

  it('sets isLatestHash based on position in onChainHashes (chain-append order)', () => {
    const latest = run('0xabc', [], { onChainHashes: ['0xold', '0xabc'], verified: { '0xabc': 1 } });
    expect(latest.isLatestHash).toBe(true);

    const notLatest = run('0xabc', [], {
      onChainHashes: ['0xabc', '0xnewer'],
      verified: { '0xabc': 1 },
    });
    expect(notLatest.isLatestHash).toBe(false);
  });

  it('filters out falsy entries from previousHashes before searching', () => {
    const result = run('0xcurrent-not-onchain', ['0xreal', null as any, undefined as any], {
      onChainHashes: ['0xreal'],
      verified: { '0xreal': 1 },
    });
    expect(result.matchedPreviousHash).toBe('0xreal');
  });
});
